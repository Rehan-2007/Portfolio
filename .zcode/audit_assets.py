from __future__ import annotations

import argparse
import io
import json
import math
import posixpath
import re
import stat
import struct
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath
from typing import Any

MAX_MEMBER = 300 * 1024 * 1024
MAX_TOTAL = 600 * 1024 * 1024
MAX_NESTING = 2
TEXT_LIMIT = 16 * 1024
IMAGE_LIMIT = 80 * 1024 * 1024
MODEL_LIMIT = 300 * 1024 * 1024

MODEL_EXTS = {'.fbx', '.obj', '.blend', '.dae', '.3ds', '.stl', '.ply', '.glb', '.gltf'}
IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.tga', '.bmp', '.webp', '.tif', '.tiff', '.exr', '.hdr'}
TEXT_EXTS = {'.txt', '.md', '.rtf', '.license', '.licence', '.mtl'}
LICENSE_WORDS = ('license', 'licence', 'readme', 'credit', 'author', 'copyright')


def safe_name(name: str) -> tuple[bool, str]:
    normalized = name.replace('\\', '/')
    path = PurePosixPath(normalized)
    unsafe = path.is_absolute() or '..' in path.parts or bool(re.match(r'^[A-Za-z]:', normalized))
    return (not unsafe, normalized)


def is_symlink(info: zipfile.ZipInfo) -> bool:
    return stat.S_ISLNK((info.external_attr >> 16) & 0xFFFF)


class Budget:
    def __init__(self) -> None:
        self.total = 0

    def read(self, archive: zipfile.ZipFile, info: zipfile.ZipInfo, limit: int = MAX_MEMBER) -> bytes:
        if info.file_size > min(limit, MAX_MEMBER):
            raise ValueError(f'member exceeds bounded read: {info.filename} ({info.file_size})')
        if self.total + info.file_size > MAX_TOTAL:
            raise ValueError(f'archive audit read budget exceeded before {info.filename}')
        data = archive.read(info)
        self.total += len(data)
        return data


def image_info(data: bytes, name: str) -> dict[str, Any]:
    result: dict[str, Any] = {'path': name, 'bytes': len(data)}
    suffix = PurePosixPath(name).suffix.lower()
    try:
        if data.startswith(b'\x89PNG\r\n\x1a\n') and len(data) >= 33:
            width, height, depth, color_type = struct.unpack_from('>IIBB', data, 16)
            channels = {0: 'L', 2: 'RGB', 3: 'P', 4: 'LA', 6: 'RGBA'}.get(color_type, f'PNG type {color_type}')
            result.update(format='PNG', size=[width, height], mode=channels, bit_depth=depth)
        elif data[:2] == b'BM' and len(data) >= 30:
            width, height = struct.unpack_from('<ii', data, 18)
            depth = struct.unpack_from('<H', data, 28)[0]
            result.update(format='BMP', size=[abs(width), abs(height)], mode=f'{depth}-bit')
        elif suffix == '.tga' and len(data) >= 18:
            width, height, depth = struct.unpack_from('<HHB', data, 12)
            result.update(format='TGA', size=[width, height], mode=f'{depth}-bit')
        elif data[:2] == b'\xff\xd8':
            cursor = 2
            size = None
            mode = None
            while cursor + 9 <= len(data):
                if data[cursor] != 0xFF:
                    cursor += 1
                    continue
                marker = data[cursor + 1]
                cursor += 2
                if marker in {0xD8, 0xD9} or 0xD0 <= marker <= 0xD7:
                    continue
                length = struct.unpack_from('>H', data, cursor)[0]
                if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                    height, width, components = struct.unpack_from('>HHB', data, cursor + 3)
                    size = [width, height]
                    mode = {1: 'L', 3: 'YCbCr/RGB', 4: 'CMYK'}.get(components, f'{components} components')
                    break
                cursor += length
            result.update(format='JPEG', size=size, mode=mode)
        else:
            result.update(format='header not decoded', header_hex=data[:32].hex())
    except Exception as exc:
        result['error'] = f'{type(exc).__name__}: {exc}'
    return result


def obj_info(data: bytes, name: str) -> dict[str, Any]:
    text = data.decode('utf-8', 'replace')
    vertices: list[tuple[float, float, float]] = []
    counts = Counter()
    objects: list[str] = []
    groups: list[str] = []
    materials: list[str] = []
    mtllibs: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        parts = stripped.split()
        tag = parts[0]
        counts[tag] += 1
        if tag == 'v' and len(parts) >= 4:
            try:
                vertices.append((float(parts[1]), float(parts[2]), float(parts[3])))
            except ValueError:
                pass
        elif tag == 'o':
            objects.append(' '.join(parts[1:]))
        elif tag == 'g':
            groups.append(' '.join(parts[1:]))
        elif tag == 'usemtl':
            materials.append(' '.join(parts[1:]))
        elif tag == 'mtllib':
            mtllibs.append(' '.join(parts[1:]))
    bounds = None
    if vertices:
        bounds = [[min(v[i] for v in vertices), max(v[i] for v in vertices)] for i in range(3)]
    return {
        'path': name,
        'bytes': len(data),
        'vertices': counts['v'],
        'texcoords': counts['vt'],
        'normals': counts['vn'],
        'faces': counts['f'],
        'objects': objects,
        'groups': groups,
        'materials_used': sorted(set(materials)),
        'mtllibs': mtllibs,
        'bounds_xyz': bounds,
    }


def mtl_info(data: bytes, name: str) -> dict[str, Any]:
    text = data.decode('utf-8', 'replace')
    materials: dict[str, dict[str, Any]] = {}
    current: dict[str, Any] | None = None
    current_name = ''
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        parts = stripped.split(maxsplit=1)
        key = parts[0]
        value = parts[1] if len(parts) > 1 else ''
        if key == 'newmtl':
            current_name = value
            current = materials.setdefault(current_name, {})
        elif current is not None and (key.startswith('map_') or key in {'bump', 'disp', 'decal', 'refl', 'Kd', 'Ks', 'Ns', 'd', 'Tr', 'illum'}):
            current[key] = value
    return {'path': name, 'materials': materials}


class FBXNode:
    __slots__ = ('name', 'props', 'children')

    def __init__(self, name: str, props: list[Any], children: list['FBXNode']) -> None:
        self.name = name
        self.props = props
        self.children = children


def parse_fbx_prop(data: bytes, offset: int) -> tuple[Any, int]:
    code = chr(data[offset])
    offset += 1
    scalars = {'Y': ('<h', 2), 'C': ('<?', 1), 'I': ('<i', 4), 'F': ('<f', 4), 'D': ('<d', 8), 'L': ('<q', 8)}
    if code in scalars:
        fmt, size = scalars[code]
        return struct.unpack_from(fmt, data, offset)[0], offset + size
    if code in {'S', 'R'}:
        length = struct.unpack_from('<I', data, offset)[0]
        offset += 4
        raw = data[offset:offset + length]
        return (raw.decode('utf-8', 'replace') if code == 'S' else raw), offset + length
    if code in {'f', 'd', 'l', 'i', 'b', 'c'}:
        length, encoding, compressed = struct.unpack_from('<III', data, offset)
        offset += 12
        raw = data[offset:offset + compressed]
        offset += compressed
        if encoding == 1:
            import zlib
            raw = zlib.decompress(raw)
        formats = {'f': '<f', 'd': '<d', 'l': '<q', 'i': '<i', 'b': '<b', 'c': '<B'}
        item_fmt = formats[code]
        item_size = struct.calcsize(item_fmt)
        if len(raw) < length * item_size:
            raise ValueError(f'truncated FBX array {code}')
        return list(struct.unpack_from(f'<{length}{item_fmt[-1]}', raw, 0)), offset
    raise ValueError(f'unsupported FBX property type {code!r}')


def parse_fbx_binary(data: bytes) -> tuple[int, list[FBXNode]]:
    if not data.startswith(b'Kaydara FBX Binary  \x00\x1a\x00'):
        raise ValueError('not binary FBX')
    version = struct.unpack_from('<I', data, 23)[0]
    wide = version >= 7500
    null_size = 25 if wide else 13

    def node(offset: int) -> tuple[FBXNode | None, int]:
        if wide:
            end, count, prop_len = struct.unpack_from('<QQQ', data, offset)
            name_len = data[offset + 24]
            header = 25
        else:
            end, count, prop_len = struct.unpack_from('<III', data, offset)
            name_len = data[offset + 12]
            header = 13
        if end == 0:
            return None, offset + null_size
        if end > len(data) or end <= offset:
            raise ValueError(f'invalid FBX node end {end} at {offset}')
        name_start = offset + header
        name = data[name_start:name_start + name_len].decode('utf-8', 'replace')
        cursor = name_start + name_len
        props = []
        for _ in range(count):
            value, cursor = parse_fbx_prop(data, cursor)
            props.append(value)
        children = []
        while cursor + null_size <= end:
            child, next_cursor = node(cursor)
            cursor = next_cursor
            if child is None:
                break
            children.append(child)
        return FBXNode(name, props, children), int(end)

    nodes = []
    cursor = 27
    while cursor + null_size <= len(data):
        parsed, cursor = node(cursor)
        if parsed is None:
            break
        nodes.append(parsed)
    return version, nodes


def walk(nodes: list[FBXNode]):
    for node in nodes:
        yield node
        yield from walk(node.children)


def mesh_components(vertex_count: int, polygon_indices: list[int]) -> tuple[int, int]:
    if vertex_count <= 0 or not polygon_indices:
        return (0, 0)
    parent = list(range(vertex_count))
    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra
    face: list[int] = []
    polygons = 0
    for raw in polygon_indices:
        end = raw < 0
        index = -raw - 1 if end else raw
        if 0 <= index < vertex_count:
            face.append(index)
        if end:
            polygons += 1
            for index in face[1:]:
                union(face[0], index)
            face = []
    used = {(-raw - 1 if raw < 0 else raw) for raw in polygon_indices}
    components = len({find(index) for index in used if 0 <= index < vertex_count})
    return polygons, components


def fbx_binary_info(data: bytes, name: str) -> dict[str, Any]:
    version, nodes = parse_fbx_binary(data)
    all_nodes = list(walk(nodes))
    geometries = []
    models = []
    materials = []
    textures = []
    for node in all_nodes:
        if node.name == 'Geometry' and len(node.props) >= 3:
            vertices = next((c.props[0] for c in node.children if c.name == 'Vertices' and c.props and isinstance(c.props[0], list)), [])
            indices = next((c.props[0] for c in node.children if c.name == 'PolygonVertexIndex' and c.props and isinstance(c.props[0], list)), [])
            vertex_count = len(vertices) // 3
            polygons, components = mesh_components(vertex_count, indices)
            bounds = None
            if vertices:
                bounds = [[min(vertices[i::3]), max(vertices[i::3])] for i in range(3)]
            uv_count = 0
            for child in walk(node.children):
                if child.name == 'UV' and child.props and isinstance(child.props[0], list):
                    uv_count += len(child.props[0]) // 2
            geometries.append({'id': node.props[0], 'name': str(node.props[1]), 'type': str(node.props[2]), 'vertices': vertex_count, 'polygons': polygons, 'components': components, 'uv_values': uv_count, 'bounds_xyz': bounds})
        elif node.name == 'Model' and len(node.props) >= 3:
            models.append({'id': node.props[0], 'name': str(node.props[1]), 'type': str(node.props[2])})
        elif node.name == 'Material' and len(node.props) >= 2:
            materials.append(str(node.props[1]))
        elif node.name in {'Texture', 'Video'} and len(node.props) >= 2:
            textures.append(str(node.props[1]))
    animation_nodes = [node for node in all_nodes if node.name in {'AnimationStack', 'AnimationLayer', 'AnimationCurveNode', 'AnimationCurve'}]
    return {'path': name, 'format': 'binary FBX', 'fbx_version': version, 'bytes': len(data), 'geometries': geometries, 'models': models, 'materials': materials, 'textures': textures, 'animation_nodes': Counter(node.name for node in animation_nodes)}


def fbx_ascii_info(data: bytes, name: str) -> dict[str, Any]:
    text = data.decode('utf-8', 'replace')
    version = re.search(r'FBXVersion:\s*(\d+)', text)
    geometries = re.findall(r'Geometry:\s*(-?\d+),\s*"Geometry::([^"]*)",\s*"([^"]*)"', text)
    models = re.findall(r'Model:\s*(-?\d+),\s*"Model::([^"]*)",\s*"([^"]*)"', text)
    materials = re.findall(r'Material:\s*-?\d+,\s*"Material::([^"]*)"', text)
    return {'path': name, 'format': 'ASCII FBX', 'fbx_version': int(version.group(1)) if version else None, 'bytes': len(data), 'geometries': [{'id': item[0], 'name': item[1], 'type': item[2]} for item in geometries], 'models': [{'id': item[0], 'name': item[1], 'type': item[2]} for item in models], 'materials': materials, 'animation_stack_names': re.findall(r'AnimationStack:\s*-?\d+,\s*"AnimStack::([^"]*)"', text)}


def blend_info(data: bytes, name: str) -> dict[str, Any]:
    result = {'path': name, 'bytes': len(data)}
    if data.startswith(b'BLENDER') and len(data) >= 12:
        result.update(format='BLEND', pointer_size=64 if data[7:8] == b'-' else 32, endian='little' if data[8:9] == b'v' else 'big', version=data[9:12].decode('ascii', 'replace'))
    else:
        result['format'] = 'unknown/non-BLEND header'
    # String evidence only, not reliable object/material inventory.
    strings = re.findall(rb'[\x20-\x7e]{5,80}', data[:min(len(data), 16 * 1024 * 1024)])
    result['notable_strings'] = sorted({s.decode('utf-8', 'replace') for s in strings if any(word in s.lower() for word in [b'laptop', b'keyboard', b'screen', b'material', b'predator'])})[:80]
    return result


def text_preview(data: bytes) -> str:
    return data[:TEXT_LIMIT].decode('utf-8', 'replace')


def audit_zip(data: bytes, label: str, depth: int, budget: Budget) -> dict[str, Any]:
    result: dict[str, Any] = {'label': label, 'bytes': len(data), 'entries': [], 'unsafe': [], 'nested': [], 'models': [], 'images': [], 'materials': [], 'documents': []}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        bad = archive.testzip()
        result['crc_test'] = 'ok' if bad is None else f'first bad member: {bad}'
        result['comment'] = archive.comment.decode('utf-8', 'replace') if archive.comment else ''
        for info in archive.infolist():
            safe, normalized = safe_name(info.filename)
            link = is_symlink(info)
            entry = {'path': normalized, 'compressed': info.compress_size, 'uncompressed': info.file_size, 'directory': info.is_dir(), 'symlink': link, 'safe': safe}
            result['entries'].append(entry)
            if not safe or link or info.file_size > MAX_MEMBER:
                result['unsafe'].append(entry)
                continue
            if info.is_dir():
                continue
            suffix = PurePosixPath(normalized).suffix.lower()
            lower = normalized.lower()
            try:
                if suffix == '.zip' and depth < MAX_NESTING:
                    nested_data = budget.read(archive, info, MAX_MEMBER)
                    result['nested'].append(audit_zip(nested_data, f'{label}!{normalized}', depth + 1, budget))
                elif suffix in MODEL_EXTS and info.file_size <= MODEL_LIMIT:
                    content = budget.read(archive, info, MODEL_LIMIT)
                    if suffix == '.obj':
                        result['models'].append(obj_info(content, normalized))
                    elif suffix == '.fbx':
                        try:
                            result['models'].append(fbx_binary_info(content, normalized) if content.startswith(b'Kaydara FBX Binary') else fbx_ascii_info(content, normalized))
                        except Exception as exc:
                            result['models'].append({'path': normalized, 'bytes': len(content), 'error': f'{type(exc).__name__}: {exc}', 'header_hex': content[:32].hex()})
                    elif suffix == '.blend':
                        result['models'].append(blend_info(content, normalized))
                    else:
                        result['models'].append({'path': normalized, 'bytes': len(content), 'header_hex': content[:32].hex()})
                elif suffix in IMAGE_EXTS and info.file_size <= IMAGE_LIMIT:
                    result['images'].append(image_info(budget.read(archive, info, IMAGE_LIMIT), normalized))
                elif suffix == '.mtl' and info.file_size <= TEXT_LIMIT:
                    content = budget.read(archive, info, TEXT_LIMIT)
                    result['materials'].append(mtl_info(content, normalized))
                elif (suffix in TEXT_EXTS or any(word in lower for word in LICENSE_WORDS)) and info.file_size <= TEXT_LIMIT:
                    result['documents'].append({'path': normalized, 'text': text_preview(budget.read(archive, info, TEXT_LIMIT))})
            except Exception as exc:
                result.setdefault('read_errors', []).append({'path': normalized, 'error': f'{type(exc).__name__}: {exc}'})
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('archives', nargs='+')
    args = parser.parse_args()
    reports = []
    for source in args.archives:
        path = Path(source)
        budget = Budget()
        if path.stat().st_size > MAX_MEMBER:
            reports.append({'label': str(path), 'error': 'outer archive exceeds 300 MB bound', 'bytes': path.stat().st_size})
            continue
        data = path.read_bytes()
        budget.total += len(data)
        try:
            report = audit_zip(data, str(path), 0, budget)
        except Exception as exc:
            report = {'label': str(path), 'bytes': len(data), 'error': f'{type(exc).__name__}: {exc}'}
        report['bounded_bytes_read'] = budget.total
        reports.append(report)
    json.dump(reports, sys.stdout, indent=2, default=lambda value: dict(value))

if __name__ == '__main__':
    main()

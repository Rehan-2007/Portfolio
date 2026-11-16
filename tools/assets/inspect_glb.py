"""Inspect an exported GLB JSON/binary layout without executing or altering it."""
import argparse
import json
import struct
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('files', nargs='+')
args = parser.parse_args()
for filename in args.files:
    path = Path(filename)
    data = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', data)
    if magic != 0x46546C67 or version != 2 or length != len(data):
        raise RuntimeError(f'Invalid GLB: {path}')
    chunk_length, chunk_type = struct.unpack_from('<II', data, 12)
    if chunk_type != 0x4E4F534A:
        raise RuntimeError('Missing GLB JSON')
    gltf = json.loads(data[20:20 + chunk_length])
    meshes = []
    triangles = 0
    for mesh in gltf.get('meshes', []):
        primitive_bounds = []
        for primitive in mesh.get('primitives', []):
            accessor = gltf['accessors'][primitive['attributes']['POSITION']]
            primitive_bounds.append({'min': accessor.get('min'), 'max': accessor.get('max'), 'vertices': accessor['count']})
            triangles += gltf['accessors'][primitive['indices']]['count'] // 3 if 'indices' in primitive else accessor['count'] // 3
        meshes.append({'name': mesh.get('name'), 'primitives': len(primitive_bounds), 'bounds': primitive_bounds})
    print(json.dumps({'path': str(path), 'bytes': len(data), 'nodes': gltf.get('nodes', []), 'meshes': meshes, 'triangles': triangles, 'materials': gltf.get('materials', []), 'images': gltf.get('images', []), 'extensionsRequired': gltf.get('extensionsRequired', [])}, indent=2))

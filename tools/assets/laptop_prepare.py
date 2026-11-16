"""Trusted Predator laptop inspection/conversion. Never executes embedded text blocks.
Run Blender with --factory-startup --disable-autoexec --python-exit-code 1.
"""
import argparse
import json
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


def args_parse():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--source', required=True)
    p.add_argument('--textures', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--mode', choices=['inspect', 'convert'], default='inspect')
    return p.parse_args(args)


def socket_value(socket):
    v = getattr(socket, 'default_value', None)
    if v is None:
        return None
    if isinstance(v, (str, float, int, bool)):
        return v
    try:
        return list(v)
    except TypeError:
        return str(v)


def bounds(obj):
    if obj.type != 'MESH' or not obj.data.vertices:
        return None
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    lo = [min(p[a] for p in points) for a in range(3)]
    hi = [max(p[a] for p in points) for a in range(3)]
    return {'min': lo, 'max': hi, 'size': [hi[a] - lo[a] for a in range(3)]}


def inspect_scene():
    objects = []
    for obj in bpy.data.objects:
        entry = {'name': obj.name, 'type': obj.type, 'bounds_world': bounds(obj),
                 'location': list(obj.location), 'rotation_euler': list(obj.rotation_euler),
                 'scale': list(obj.scale), 'matrix_world': [list(row) for row in obj.matrix_world],
                 'hide_render': obj.hide_render, 'hide_viewport': obj.hide_viewport,
                 'parent': obj.parent.name if obj.parent else None,
                 'materials': [m.name if m else None for m in getattr(obj.data, 'materials', [])],
                 'modifiers': [{'name': m.name, 'type': m.type, 'show_render': m.show_render} for m in obj.modifiers]}
        if obj.type == 'MESH':
            mesh = obj.data
            mesh.calc_loop_triangles()
            entry.update(vertices=len(mesh.vertices), polygons=len(mesh.polygons), triangles=len(mesh.loop_triangles),
                         uv_layers=[u.name for u in mesh.uv_layers],
                         material_polygon_counts={str(i): sum(1 for p in mesh.polygons if p.material_index == i) for i in range(len(mesh.materials))})
        objects.append(entry)
    materials = []
    for mat in bpy.data.materials:
        entry = {'name': mat.name, 'use_nodes': mat.use_nodes, 'diffuse_color': list(mat.diffuse_color)}
        if mat.use_nodes:
            entry['nodes'] = [{'name': n.name, 'type': n.type, 'bl_idname': n.bl_idname,
                               'image': n.image.name if n.type == 'TEX_IMAGE' and n.image else None,
                               'uv_map': getattr(n, 'uv_map', None),
                               'operation': getattr(n, 'operation', None),
                               'inputs': {s.name: socket_value(s) for s in n.inputs if not s.is_linked}}
                              for n in mat.node_tree.nodes]
            entry['links'] = [{'from_node': l.from_node.name, 'from_socket': l.from_socket.name,
                               'to_node': l.to_node.name, 'to_socket': l.to_socket.name} for l in mat.node_tree.links]
        materials.append(entry)
    images = []
    for img in bpy.data.images:
        resolved = bpy.path.abspath(img.filepath)
        images.append({'name': img.name, 'filepath': img.filepath, 'resolved': resolved,
                       'exists': os.path.isfile(resolved), 'packed': bool(img.packed_file),
                       'packed_size': img.packed_file.size if img.packed_file else 0,
                       'size': list(img.size), 'source': img.source, 'colorspace': img.colorspace_settings.name})
    return {'blender_version': bpy.app.version_string, 'source_identity': 'Predator laptop, not AuroraCAD',
            'objects': objects, 'materials': materials, 'images': images,
            'text_blocks_not_executed': [t.name for t in bpy.data.texts],
            'scene': {'name': bpy.context.scene.name, 'unit_scale': bpy.context.scene.unit_settings.scale_length}}


import hashlib
import shutil
import struct


def file_hash(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def resolve_images(texture_dir, output):
    """Packed pixels are authoritative; staged truncated derivatives are not replacements."""
    records = []
    packed_dir = output / 'packed-textures'
    packed_dir.mkdir(exist_ok=True)
    external_dir = output / 'staged-textures'
    external_dir.mkdir(exist_ok=True)
    for path in sorted(texture_dir.iterdir()):
        if path.is_file():
            shutil.copy2(path, external_dir / path.name)
    for img in bpy.data.images:
        if img.source != 'FILE':
            continue
        old_path = img.filepath
        if img.packed_file and img.packed_file.size > 0 and min(img.size) > 0:
            # No reload/unpack operation: retain Blender's original decoded packed pixels.
            suffix = '.hdr' if img.name.endswith('.hdr') else ('.png' if '.png' in img.name else '.jpg')
            target = packed_dir / (img.name.replace('/', '_').replace('\\', '_') + suffix)
            target.write_bytes(bytes(img.packed_file.data))
            # PackedImage stores a second path; fix both before Blender's repack callback.
            for packed_image in img.packed_files:
                packed_image.filepath = str(target)
            img.filepath = str(target)
            records.append({'image': img.name, 'old_external_path': old_path,
                            'resolution': 'valid packed original retained', 'corrected_path': str(target),
                            'packed_bytes': img.packed_file.size, 'pixel_size': list(img.size),
                            'sha256': file_hash(target)})
        else:
            wanted = Path(old_path.replace('\\', '/')).name
            candidates = [p for p in texture_dir.iterdir() if p.is_file() and p.name.lower() == wanted.lower()]
            if len(candidates) != 1:
                raise RuntimeError('Actually missing/ambiguous unpacked image: ' + img.name)
            img.filepath = str(candidates[0])
            img.reload()
            if min(img.size) <= 0:
                raise RuntimeError('Image cannot decode: ' + img.name)
            records.append({'image': img.name, 'resolution': 'exact external file', 'corrected_path': img.filepath})
    return records


def bake_color_ramp(mat, output):
    """Exact emission-only UV bake of unsupported ColorRamp; never includes AO/light/shadow."""
    source_bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    link = source_bsdf.inputs['Base Color'].links[0]
    if link.from_node.type != 'VALTORGB':
        return None
    ramp = link.from_node
    settings = {'interpolation': ramp.color_ramp.interpolation,
                'elements': [{'position': e.position, 'color': list(e.color)} for e in ramp.color_ramp.elements]}
    scene = bpy.context.scene
    saved_engine = scene.render.engine
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 1
    scene.cycles.device = 'CPU'
    scene.render.bake.use_clear = True
    image = bpy.data.images.new('Predator_SheetMetal_BaseColor_Ramp', width=2048, height=2048, alpha=False)
    image.colorspace_settings.name = 'sRGB'
    baking_mat = mat.copy()
    tree = baking_mat.node_tree
    out = next(n for n in tree.nodes if n.type == 'OUTPUT_MATERIAL')
    emission = tree.nodes.new('ShaderNodeEmission')
    emission.inputs['Strength'].default_value = 1
    if emission.inputs.get('Weight'):
        emission.inputs['Weight'].default_value = 1
    tree.links.new(tree.nodes[ramp.name].outputs['Color'], emission.inputs['Color'])
    tree.links.new(emission.outputs[0], out.inputs['Surface'])
    for l in list(out.inputs['Displacement'].links):
        tree.links.remove(l)
    target = tree.nodes.new('ShaderNodeTexImage')
    target.image = image
    tree.nodes.active = target
    # Blender-generated temporary bake plane is removed; not substituted into export.
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, -100))
    plane = bpy.context.object
    plane.name = '__TRUSTED_BAKE_PLANE__'
    plane.data.materials.append(baking_mat)
    bpy.ops.object.bake(type='EMIT', margin=0)
    bpy.data.objects.remove(plane, do_unlink=True)
    bpy.data.materials.remove(baking_mat)
    image.filepath_raw = str(output / 'Predator_SheetMetal_BaseColor_Ramp.png')
    image.file_format = 'PNG'
    image.save()
    image.pack()
    tree = mat.node_tree
    baked = tree.nodes.new('ShaderNodeTexImage')
    baked.image = image
    original_texture = ramp.inputs[0].links[0].from_node
    if original_texture.inputs['Vector'].is_linked:
        tree.links.new(original_texture.inputs['Vector'].links[0].from_socket, baked.inputs['Vector'])
    tree.links.new(baked.outputs['Color'], source_bsdf.inputs['Base Color'])
    scene.render.engine = saved_engine
    return {'material': mat.name, 'operation': '2048x2048 exact ColorRamp emission bake',
            'source_image': original_texture.image.name, 'ramp': settings,
            'lighting_ao_cast_shadows_baked': False, 'image': image.name}


def geometry_stats(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    total_triangles = 0
    total_vertices = 0
    by_object = []
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        total_triangles += len(mesh.loop_triangles)
        total_vertices += len(mesh.vertices)
        points.extend(obj.matrix_world @ v.co for v in mesh.vertices)
        by_object.append({'name': obj.name, 'vertices': len(mesh.vertices), 'triangles': len(mesh.loop_triangles)})
        evaluated.to_mesh_clear()
    lo = Vector([min(p[a] for p in points) for a in range(3)])
    hi = Vector([max(p[a] for p in points) for a in range(3)])
    return {'vertices': total_vertices, 'triangles': total_triangles, 'objects': by_object,
            'bounds': {'min': list(lo), 'max': list(hi), 'size': list(hi - lo)}}


def glb_xyz(v):
    return [v[0], v[2], -v[1]]


def screen_info(obj):
    # Material.004 is the actual glass display: two opposing original polygons.
    records = []
    for poly in obj.data.polygons:
        if obj.data.materials[poly.material_index].name != 'Material.004':
            continue
        vertices = [obj.matrix_world @ obj.data.vertices[i].co for i in poly.vertices]
        normal = (obj.matrix_world.to_3x3().inverted().transposed() @ poly.normal).normalized()
        uv_layer = obj.data.uv_layers.active
        records.append({'polygon_index': poly.index, 'vertex_indices': list(poly.vertices),
                        'corners_glb': [glb_xyz(v) for v in vertices], 'normal_glb': glb_xyz(normal),
                        'uvs': [list(uv_layer.data[i].uv) for i in poly.loop_indices],
                        'bounds_glb': {'min': [min(glb_xyz(v)[a] for v in vertices) for a in range(3)],
                                       'max': [max(glb_xyz(v)[a] for v in vertices) for a in range(3)]}})
    all_corners = [Vector(v) for face in records for v in face['corners_glb']]
    combined_min = Vector([min(v[a] for v in all_corners) for a in range(3)])
    combined_max = Vector([max(v[a] for v in all_corners) for a in range(3)])
    return {'object_name': obj.name, 'material_name': 'Material.004', 'material_slot': 2,
            'description': 'Two coplanar original display faces forming upper and lower screen regions in lid Cube.001; not opposing faces and not an added substitute plane',
            'front_direction_glb': [0, 0, -1], 'faces': records,
            'combined_bounds_glb': {'min': list(combined_min), 'max': list(combined_max)},
            'screen_size_glb': list(combined_max - combined_min),
            'screen_center_glb': list((combined_min + combined_max) * .5),
            'runtime_overlay_suggestion': 'Keep originals. Overlay at z=5.02645, normal -Z, center x=-0.008033/y=6.159459, max size 15.664343x9.046173; inset for slightly tapered upper edge. Existing UVs are not rectangular 0..1, so use documented plane bounds rather than replacing texture by UV blindly.'}


def check_glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from('<4sII', data)
    assert magic == b'glTF' and version == 2 and length == len(data)
    chunk_len, chunk_type = struct.unpack_from('<II', data, 12)
    assert chunk_type == 0x4E4F534A
    doc = json.loads(data[20:20 + chunk_len])
    triangles = 0
    primitives = 0
    for mesh in doc.get('meshes', []):
        for p in mesh['primitives']:
            assert p.get('mode', 4) == 4
            primitives += 1
            accessor = doc['accessors'][p['indices']] if 'indices' in p else doc['accessors'][p['attributes']['POSITION']]
            triangles += accessor['count'] // 3
            assert 'NORMAL' in p['attributes'] and 'TEXCOORD_0' in p['attributes']
    assert not doc.get('cameras')
    assert all('uri' not in i and 'bufferView' in i for i in doc.get('images', []))
    assert not any('occlusionTexture' in m for m in doc.get('materials', []))
    return {'bytes': len(data), 'sha256': file_hash(path), 'mesh_count': len(doc.get('meshes', [])),
            'node_count': len(doc.get('nodes', [])), 'primitives': primitives, 'triangles': triangles,
            'materials': [m.get('name') for m in doc.get('materials', [])],
            'images': [{'name': i.get('name'), 'mime_type': i.get('mimeType'),
                        'bytes': doc['bufferViews'][i['bufferView']]['byteLength']} for i in doc.get('images', [])],
            'extensions_used': doc.get('extensionsUsed', []),
            'nodes': [{'name': n.get('name'), 'mesh': n.get('mesh')} for n in doc.get('nodes', [])],
            'all_meshes_keep_normals_uv0': True, 'embedded_images_only': True,
            'cameras_lights_ao_exported': False}


def render_validation(output, size):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.use_nodes = False
    scene.view_settings.view_transform = 'AgX'
    world = bpy.data.worlds.new('Trusted neutral validation world')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.32, .35, .40, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .8
    for obj in list(scene.objects):
        if obj.type == 'MESH':
            obj.visible_shadow = False
    target = Vector((0, 0, size[2] * .42))
    lights = [((-12, 6, 22), 22000, 13), ((13, 2, 14), 16000, 10), ((0, -14, 20), 18000, 12)]
    created = []
    for i, (position, power, light_size) in enumerate(lights):
        data = bpy.data.lights.new('Validation softbox ' + str(i), type='AREA')
        data.energy = power
        data.shape = 'DISK'
        data.size = light_size
        data.use_shadow = False
        obj = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(obj)
        obj.location = position
        obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()
        created.append(obj)
    camera_data = bpy.data.cameras.new('Validation camera')
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 22
    created.append(camera)
    views = {'front-threequarter': (19, 27, 19), 'front': (0, 30, 12),
             'rear-threequarter': (-20, -27, 18), 'top-keyboard': (0, 8, 34)}
    outputs = []
    for name, position in views.items():
        camera.location = position
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(output / ('validation-' + name + '.png'))
        bpy.ops.render.render(write_still=True)
        outputs.append({'path': scene.render.filepath, 'view': name, 'cast_shadows': False, 'ao': False})
    for obj in created:
        bpy.data.objects.remove(obj, do_unlink=True)
    return outputs


def convert(args, report, source, output):
    textures = Path(args.textures).resolve()
    warnings = []
    report['source_sha256'] = file_hash(source)
    report['texture_resolutions'] = resolve_images(textures, output)
    report['missing_original_texture_images'] = []
    report['staged_derivatives_preserved'] = [{'name': p.name, 'sha256': file_hash(p)}
                                              for p in sorted(textures.iterdir()) if p.is_file()]
    # Never allow imported handlers, animation/drivers or original compositor to run.
    for obj in bpy.data.objects:
        obj.animation_data_clear()
    for mat in bpy.data.materials:
        mat.animation_data_clear()
        if mat.node_tree:
            mat.node_tree.animation_data_clear()
    scene = bpy.context.scene
    scene.animation_data_clear()
    scene.use_nodes = False
    removed = []
    for obj in list(bpy.data.objects):
        if obj.type in {'CAMERA', 'LIGHT'}:
            removed.append({'name': obj.name, 'type': obj.type})
            bpy.data.objects.remove(obj, do_unlink=True)
    report['removed_embedded_cameras_lights'] = removed
    weights_fixed = []
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type in {'BSDF_PRINCIPLED', 'EMISSION'} and node.inputs.get('Weight') and node.inputs['Weight'].default_value == 0:
                node.inputs['Weight'].default_value = 1
                weights_fixed.append(mat.name)
        # glTF has no displacement channel; retain original mesh, do not displace geometry.
        for node in mat.node_tree.nodes:
            if node.type == 'OUTPUT_MATERIAL':
                for link in list(node.inputs['Displacement'].links):
                    mat.node_tree.links.remove(link)
                    warnings.append(mat.name + ': texture displacement disconnected (not a GLB channel); packed image retained, no geometry change')
    report['blender_5_3_legacy_shader_weight_compensation'] = weights_fixed
    report['unsupported_channel_operations'] = [bake_color_ramp(bpy.data.materials['Material.002'], output)]
    # Keep original hinges/keys/proportions; evaluate the original mirror modifier during export.
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    assert len(meshes) == 18
    before = geometry_stats(meshes)
    lo = Vector(before['bounds']['min'])
    hi = Vector(before['bounds']['max'])
    scale = 16.0 / max(hi - lo)
    center_ground = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    wrapper = bpy.data.objects.new('Predator_Normalized_Root', None)
    scene.collection.objects.link(wrapper)
    wrapper['source_identity'] = 'Predator laptop'
    wrapper['cast_shadow'] = False
    wrapper['receive_shadow'] = False
    wrapper['normalization_span'] = 16.0
    for obj in meshes:
        matrix = obj.matrix_world.copy()
        obj.parent = wrapper
        obj.matrix_world = matrix
        obj['source_object_name'] = obj.name
        obj['cast_shadow'] = False
        obj['receive_shadow'] = False
    wrapper.matrix_world = Matrix.Scale(scale, 4) @ Matrix.Translation(-center_ground)
    bpy.context.view_layer.update()
    after = geometry_stats(meshes)
    report['geometry_original_evaluated'] = before
    report['geometry_normalized_evaluated'] = after
    assert before['triangles'] == after['triangles']
    report['normalization'] = {'uniform_scale': scale, 'source_ground_center': list(center_ground),
                               'source_up': '+Z', 'export_up': '+Y', 'export_front': '-Z',
                               'glb_mapping': '(X,Y,Z)=(source.x-center.x, source.z-ground.z, -(source.y-center.y))*scale',
                               'glb_bounds': {'min': [after['bounds']['min'][0], after['bounds']['min'][2], -after['bounds']['max'][1]],
                                              'max': [after['bounds']['max'][0], after['bounds']['max'][2], -after['bounds']['min'][1]]}}
    report['screen'] = screen_info(bpy.data.objects['Cube.001'])
    bpy.ops.object.select_all(action='DESELECT')
    wrapper.select_set(True)
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = wrapper
    glb = output / 'predator-laptop.glb'
    options = dict(filepath=str(glb), export_format='GLB', export_image_format='AUTO',
                   use_selection=True, export_apply=True, export_yup=True, export_normals=True,
                   export_texcoords=True, export_materials='EXPORT', export_cameras=False,
                   export_lights=False, export_extras=True, export_animations=False,
                   export_occlusion=False, export_draco_mesh_compression_enable=False)
    available = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
    report['export_options'] = {k: v for k, v in options.items() if k in available}
    report['export_options_unsupported_omitted'] = [k for k in options if k not in available]
    bpy.ops.export_scene.gltf(**report['export_options'])
    report['glb'] = check_glb(glb)
    if report['glb']['triangles'] != before['triangles']:
        warnings.append('Exporter triangle count differs from evaluated source; inspect geometry reports before use')
    report['warnings'] = warnings
    (output / 'conversion-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    # Validate the actual exported GLB, not the richer original Blender scene.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    report['validation_renders'] = render_validation(output, Vector(after['bounds']['size']))
    report['validation_note'] = 'Images rendered from reimported GLB; neutral softboxes, all cast shadows disabled, no AO bake. Visual review delegated to primary agent.'
    (output / 'conversion-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('PREDATOR_CONVERT ' + json.dumps({'glb': str(glb), 'bytes': report['glb']['bytes'],
                                            'triangles': report['glb']['triangles'], 'materials': len(report['glb']['materials']),
                                            'images': len(report['glb']['images']), 'warnings': warnings,
                                            'screen': report['screen'], 'normalization': report['normalization']}))


def main():
    args = args_parse()
    source = Path(args.source).resolve()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    report = inspect_scene()
    report['source_file'] = str(source)
    (output / 'inspection.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('PREDATOR_INSPECT ' + json.dumps({'objects': len(report['objects']), 'materials': len(report['materials']), 'images': len(report['images'])}))
    if args.mode == 'convert':
        convert(args, report, source, output)
    else:
        for obj in report['objects']:
            print('OBJECT ' + json.dumps(obj))
        for mat in report['materials']:
            print('MATERIAL ' + json.dumps(mat))
        for img in report['images']:
            print('IMAGE ' + json.dumps(img))


if __name__ == '__main__':
    main()

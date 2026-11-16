"""Trusted headless asset preparation. Run from outside the untrusted asset folder."""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument('--kind', required=True, choices=['b2', 'cube', 'wrap'])
    parser.add_argument('--source', required=True)
    parser.add_argument('--textures')
    parser.add_argument('--output', required=True)
    parser.add_argument('--render', action='store_true')
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def bounds(objects):
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    lower = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    upper = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    return lower, upper


def normalize(objects, target_size, ground=False):
    lower, upper = bounds(objects)
    size = upper - lower
    factor = target_size / max(size)
    center = (lower + upper) * 0.5
    if ground:
        center.z = lower.z
    transform = Matrix.Scale(factor, 4) @ Matrix.Translation(-center)
    for obj in objects:
        obj.matrix_world = transform @ obj.matrix_world
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return factor


def material(name, color, metallic=0, roughness=0.5):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    return result, shader


def texture_node(mat, path, color=True):
    if not path.is_file():
        raise RuntimeError(f'Missing required texture: {path}')
    # Force actual image data to load, preserving source files.
    image = bpy.data.images.load(str(path), check_existing=False)
    image.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    if image.size[0] == 0:
        raise RuntimeError(f'Texture could not be decoded: {path}')
    image.pack()
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = image
    return node


def connect_normal(mat, shader, path, strength=1):
    node = texture_node(mat, path, False)
    normal = mat.node_tree.nodes.new('ShaderNodeNormalMap')
    normal.inputs['Strength'].default_value = strength
    mat.node_tree.links.new(node.outputs['Color'], normal.inputs['Color'])
    mat.node_tree.links.new(normal.outputs['Normal'], shader.inputs['Normal'])


def b2(args):
    bpy.ops.wm.fbx_import(filepath=args.source, use_anim=False, use_custom_normals=True)
    objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if len(objects) != 1:
        raise RuntimeError(f'Expected one supplied B-2 mesh, got {len(objects)}')
    aircraft = objects[0]
    # The FBX importer already maps source Y-up into Blender Z-up.
    # Bake the imported matrix once; glTF export then maps Z-up to runtime Y-up.
    bpy.context.view_layer.update()
    aircraft.data.transform(aircraft.matrix_world)
    aircraft.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()
    normalize(objects, 56)
    aircraft.name = 'B2_Player'
    textures = Path(args.textures)
    mat, shader = material('B2_SuppliedPBR', (1, 1, 1), 0.35, 0.46)
    diffuse = texture_node(mat, textures / 'ggg_diffuseOriginal.jpg')
    mat.node_tree.links.new(diffuse.outputs['Color'], shader.inputs['Base Color'])
    metallic = texture_node(mat, textures / 'ggg_metallic.jpg', False)
    mat.node_tree.links.new(metallic.outputs['Color'], shader.inputs['Metallic'])
    connect_normal(mat, shader, textures / 'ggg_normal.jpg', 0.7)
    aircraft.data.materials.clear()
    aircraft.data.materials.append(mat)
    for polygon in aircraft.data.polygons:
        polygon.material_index = 0
    return objects, ['Source roughness.jpg is absent; scalar roughness 0.46 used.', 'Source normal, diffuse and metallic JPEGs preserved; height not applied.']


def cube(args):
    bpy.ops.wm.fbx_import(filepath=args.source, use_anim=False, use_custom_normals=True)
    objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if len(objects) != 1:
        raise RuntimeError('Expected the supplied single Rubik mesh')
    obj = objects[0]
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE')
    bpy.ops.object.mode_set(mode='OBJECT')
    objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and len(obj.data.polygons) > 0]
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH' and len(obj.data.polygons) == 0:
            bpy.data.objects.remove(obj, do_unlink=True)
    if len(objects) != 26:
        raise RuntimeError(f'Expected 26 visible supplied cubelets, found {len(objects)}')
    normalize(objects, 6)
    lower, upper = bounds(objects)
    center = (lower + upper) / 2
    spacing = (upper.x - lower.x) / 3
    occupied = set()
    for obj in objects:
        lo, hi = bounds([obj])
        centroid = (lo + hi) / 2 - center
        # Names encode GLTF axes: Blender x, z, -y => runtime x,y,z.
        grid = tuple(max(-1, min(1, round(value / spacing))) for value in (centroid.x, centroid.z, -centroid.y))
        if grid in occupied or any(value not in [-1, 0, 1] for value in grid):
            raise RuntimeError(f'Invalid cubelet grid cell: {grid}')
        occupied.add(grid)
        obj.name = 'cubelet_' + '_'.join(str(value) for value in grid)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
        for slot in obj.material_slots:
            if not slot.material:
                continue
            slot.material.use_nodes = True
            shader = slot.material.node_tree.nodes.get('Principled BSDF')
            shader.inputs['Metallic'].default_value = 0.03
            shader.inputs['Roughness'].default_value = 0.36
    return objects, ['All 26 loose components preserved as individually named cubelets; source color materials retained.']


def wrap(args):
    bpy.ops.wm.obj_import(filepath=args.source, forward_axis='NEGATIVE_Z', up_axis='Y', use_split_objects=False, use_split_groups=True)
    objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if not objects:
        raise RuntimeError('OBJ contains no meshes')
    textures = Path(args.textures)
    mats = {}
    for key, color in [('cover', 'wrapcov.png'), ('bread', 'chap.png'), ('food', 'Untitled-1foodinside.png')]:
        mat, shader = material('Wrap_' + key, (1, 1, 1), 0, 0.72)
        tex = texture_node(mat, textures / color)
        mat.node_tree.links.new(tex.outputs['Color'], shader.inputs['Base Color'])
        if key == 'bread':
            connect_normal(mat, shader, textures / 'chap_-nrm.png', 0.55)
            rough = texture_node(mat, textures / 'chap-rough.png', False)
            mat.node_tree.links.new(rough.outputs['Color'], shader.inputs['Roughness'])
        elif key == 'cover':
            connect_normal(mat, shader, textures / 'NormalMap_(2).png', 0.55)
        mats[key] = mat
    mapping = {'aiStandardSurface3SG': 'cover', 'aiStandardSurface1SG': 'bread', 'aiStandardSurface2SG': 'food'}
    for obj in objects:
        for i, slot in enumerate(obj.material_slots):
            old_name = slot.material.name if slot.material else ''
            mapped = next((value for name, value in mapping.items() if old_name.startswith(name)), None)
            if mapped is None:
                raise RuntimeError(f'Unrecognised supplied OBJ material slot: {old_name}')
            obj.data.materials[i] = mats[mapped]
    normalize(objects, 8, ground=True)
    return objects, ['Fra.mtl is missing. Materials reconstructed from supplied semantic OBJ groups and texture names; visual verification required.', 'AO maps omitted under no-cast-shadow policy.']


def report(objects, warnings, output):
    lower, upper = bounds(objects)
    images = []
    used_materials = {slot.material for obj in objects for slot in obj.material_slots if slot.material}
    used_images = {node.image for mat in used_materials for node in mat.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image}
    for image in used_images:
        images.append({'name': image.name, 'size': list(image.size), 'color_space': image.colorspace_settings.name, 'packed': bool(image.packed_file)})
    triangles = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    data = {'objects': [obj.name for obj in objects], 'meshes': len(objects), 'vertices': sum(len(obj.data.vertices) for obj in objects), 'triangles': triangles,
            'bounds_blender': {'min': list(lower), 'max': list(upper), 'size': list(upper - lower)},
            'materials': [mat.name for mat in used_materials], 'images': images, 'warnings': warnings}
    (output / 'report.json').write_text(json.dumps(data, indent=2), encoding='utf-8')


def export(objects, output):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    for obj in list(bpy.context.scene.objects):
        if obj not in objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output / 'prepared.blend'))
    bpy.ops.export_scene.gltf(filepath=str(output / 'model.glb'), export_format='GLB', use_selection=True,
                            export_yup=True, export_apply=False, export_cameras=False, export_lights=False,
                            export_animations=False, export_image_format='AUTO', export_extras=False,
                            export_tangents=True, export_keep_originals=False)


def turntable(objects, output):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.render.resolution_x = 800
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value = (0.24, 0.29, 0.37, 1)
    scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value = 0.75
    lower, upper = bounds(objects)
    centre = (lower + upper) / 2
    extent = max(upper - lower)
    for i, (position, energy, color) in enumerate([((-1.0, -0.8, 1.4), 190 * extent * extent, (1.0, 0.86, 0.72)), ((0.8, 0.8, 0.6), 75 * extent * extent, (0.67, 0.8, 1.0))]):
        data = bpy.data.lights.new(f'ValidationLight{i}', 'AREA')
        data.energy = energy
        data.color = color
        data.size = extent
        data.use_shadow = False
        obj = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(obj)
        obj.location = centre + Vector(position) * extent
        obj.rotation_euler = (centre - obj.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data = bpy.data.cameras.new('ValidationCamera')
    camera = bpy.data.objects.new('ValidationCamera', camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = extent * 1.38
    camera_data.clip_end = extent * 10
    for index, (angle, elevation) in enumerate([(25, 27), (140, 42), (245, 65)]):
        azimuth, el = math.radians(angle), math.radians(elevation)
        camera.location = centre + Vector((math.sin(azimuth) * math.cos(el), -math.cos(azimuth) * math.cos(el), math.sin(el))) * extent * 2.2
        camera.rotation_euler = (centre - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(output / f'validation_{index}.png')
        bpy.ops.render.render(write_still=True)


def main():
    args = arguments()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    clear_scene()
    objects, warnings = {'b2': b2, 'cube': cube, 'wrap': wrap}[args.kind](args)
    report(objects, warnings, output)
    export(objects, output)
    if args.render:
        turntable(objects, output)

main()

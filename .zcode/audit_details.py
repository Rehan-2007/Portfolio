from __future__ import annotations
import hashlib, io, importlib.util, json, re, zipfile
from collections import Counter
from pathlib import Path

helper_path = Path(__file__).with_name('audit_assets.py')
spec = importlib.util.spec_from_file_location('anti_ai_audit_assets', helper_path)
if spec is None or spec.loader is None:
    raise RuntimeError('Unable to load trusted archive helper')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
parse_fbx_binary = helper.parse_fbx_binary
walk = helper.walk


def fbx_detail(archive_path: str, nested: str | None, fbx_name: str):
    with zipfile.ZipFile(archive_path) as outer:
        source = zipfile.ZipFile(io.BytesIO(outer.read(nested))) if nested else outer
        data = source.read(fbx_name)
        version, roots = parse_fbx_binary(data)
        nodes = list(walk(roots))
        objects = {}
        for node in nodes:
            if node.name in {'Geometry', 'Model', 'Material', 'Texture', 'Video'} and node.props:
                object_id = node.props[0]
                children = {}
                for child in node.children:
                    if child.name in {'FileName', 'RelativeFilename'} and child.props:
                        children[child.name] = str(child.props[0])
                    elif child.name == 'Properties70':
                        properties = {}
                        for prop in child.children:
                            if prop.name == 'P' and prop.props:
                                properties[str(prop.props[0])] = prop.props[4:]
                        children['Properties70'] = properties
                objects[object_id] = {'kind': node.name, 'name': str(node.props[1]) if len(node.props)>1 else '', 'type': str(node.props[2]) if len(node.props)>2 else '', **children}
        connections = []
        for root in roots:
            if root.name != 'Connections': continue
            for connection in root.children:
                if connection.name == 'C' and len(connection.props) >= 3:
                    connections.append({'relation': connection.props[0], 'source': connection.props[1], 'target': connection.props[2], 'property': connection.props[3] if len(connection.props)>3 else None})
        geometries = []
        for node in nodes:
            if node.name != 'Geometry': continue
            vertices = next((c.props[0] for c in node.children if c.name=='Vertices' and c.props), [])
            indices = next((c.props[0] for c in node.children if c.name=='PolygonVertexIndex' and c.props), [])
            faces=[]; face=[]
            for raw in indices:
                face.append(-raw-1 if raw<0 else raw)
                if raw<0: faces.append(face); face=[]
            hist=Counter(map(len,faces))
            key_for=[tuple(round(vertices[i*3+j],5) for j in range(3)) for i in range(len(vertices)//3)]
            parent={k:k for k in set(key_for)}
            def find(k):
                while parent[k]!=k: parent[k]=parent[parent[k]]; k=parent[k]
                return k
            def union(a,b):
                a,b=find(a),find(b)
                if a!=b: parent[b]=a
            for face in faces:
                if face:
                    for index in face[1:]: union(key_for[face[0]],key_for[index])
            components=len({find(key_for[index]) for face in faces for index in face})
            geometries.append({'name':str(node.props[1]),'polygon_sizes':dict(hist),'triangles_after_triangulation':sum(max(0,len(f)-2) for f in faces),'welded_coordinate_components':components,'unique_positions':len(set(key_for))})
        resolved=[]
        for connection in connections:
            source_obj=objects.get(connection['source']); target_obj=objects.get(connection['target'])
            if source_obj or target_obj:
                resolved.append({**connection,'source_object':source_obj,'target_object':target_obj})
        return {'archive':archive_path,'fbx':fbx_name,'version':version,'geometries':geometries,'objects':list(objects.values()),'connections':resolved}


def wrap_detail(path: str):
    with zipfile.ZipFile(path) as archive:
        obj=archive.read('source/Faa.obj').decode('utf-8','replace')
        group='default'; material=''; sections=Counter(); mtllib=[]
        for line in obj.splitlines():
            parts=line.strip().split(maxsplit=1)
            if not parts: continue
            if parts[0]=='g': group=parts[1] if len(parts)>1 else 'default'
            elif parts[0]=='usemtl': material=parts[1] if len(parts)>1 else ''
            elif parts[0]=='mtllib': mtllib.append(parts[1] if len(parts)>1 else '')
            elif parts[0]=='f': sections[(group,material)]+=1
        names=[i.filename for i in archive.infolist()]
        return {'archive':path,'mtllib':mtllib,'mtl_present':[name in names for name in mtllib],'group_material_face_counts':[{'group':g,'material':m,'faces':n} for (g,m),n in sections.items()]}


def laptop_detail(path: str):
    with zipfile.ZipFile(path) as archive:
        entries=archive.infolist(); counts=Counter(i.filename for i in entries)
        duplicates={name:count for name,count in counts.items() if count>1}
        duplicate_hashes={name:[hashlib.sha256(archive.read(i)).hexdigest() for i in entries if i.filename==name] for name in duplicates}
        blend=archive.read('source/Laptop Predator.blend')
        strings=[s.decode('utf-8','replace') for s in re.findall(rb'[\x20-\x7e]{5,260}',blend)]
        paths=sorted({s for s in strings if re.search(r'\.(?:png|jpe?g|tga|exr|hdr|bmp)',s,re.I)})
        object_hints=sorted({s for s in strings if re.search(r'(?:laptop|keyboard|screen|display|hinge|trackpad|touchpad|predator)',s,re.I)})[:200]
        return {'archive':path,'duplicate_paths':duplicates,'duplicate_sha256':duplicate_hashes,'embedded_or_external_image_strings':paths[:200],'identity_strings':object_hints}

result=[
 fbx_detail('D:/b-2-spirit-bomber.zip','source/untitled.zip','untitled.fbx'),
 fbx_detail('D:/rubiks-cube-solved.zip',None,'source/rubiks_cube.fbx'),
 wrap_detail('D:/frankie-wrap.zip'),
 laptop_detail('D:/laptop-alienpredator.zip'),
]
print(json.dumps(result,indent=2,default=str))

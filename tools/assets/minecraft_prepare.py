"""Bounded legacy Anvil crop conversion; trusted script, never execute world code.
Decode: python -I minecraft_prepare.py decode --source WORLD --textures DIR --output DIR
Export: blender --background --factory-startup --disable-autoexec --python-exit-code 1
        --python minecraft_prepare.py -- export --textures DIR --output DIR [--render]
No third-party Python dependencies. Blender is used only to decode supplied PNGs/export.
"""
from __future__ import annotations
import argparse
import collections
import gzip
import hashlib
import json
import math
import struct
import sys
import zlib
from pathlib import Path

CROP = (-291, -198, 49, 118, 510, 606)  # inclusive source coordinates
WOOD = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'big_oak']
STAIRS = {53: 'plank_oak', 67: 'cobblestone', 109: 'stone_brick',
          134: 'plank_spruce', 135: 'plank_birch', 136: 'plank_jungle', 163: 'plank_acacia'}
FULL = {1, 2, 3, 4, 5, 17, 35, 42, 43, 49, 87, 97, 98, 123, 125, 162, 173, 33}
KNOWN = FULL | set(STAIRS) | {30, 44, 50, 51, 68, 69, 72, 85, 96, 101, 107, 113, 126, 131, 139, 143, 145, 154, 160}
DIRECTIONS = [(1, 0), (-1, 0), (0, 1), (0, -1)]
LIMITATIONS = {
 '33': '138 pistons use invalid legacy facing 6; retained as full piston-textured cubes. Missing piston top artwork uses supplied piston_bottom.',
 '50': 'Torch alpha-textured cross planes are positioned by metadata; wall torches are not tilted and do not emit lighting.',
 '51': 'Fire retained as static supplied-texture cross planes; no animation or emissive light.',
 '69': 'Lever mount/orientation retained as boxes; handle tilt and powered animation approximated.',
 '85,113': 'Fence posts and neighbor-connected rails modeled; vanilla render-level UV unwrap is approximate.',
 '107': 'Gate orientation/open bit modeled as connected boxes; exact hinge hardware omitted.',
 '131': 'Tripwire hook orientation retained as mount/hook cuboids; curved hook geometry approximated.',
 '139': 'Cobblestone walls use connected posts/arms, with approximate cap/post reduction rules.',
 '145': 'Anvils use oriented base/stem/top boxes; bevels and exact waist profile omitted.',
 '154': 'Hoppers use open rim, stepped bowl and facing spout; tapered funnel approximated by boxes.',
 '68': 'Wall sign board retained with orientation; NBT sign text not rasterized.',
 'stairs': 'Metadata facing/upside-down plus neighboring inner/outer corner quarters modeled. Rare vanilla corner suppression rules are not reproduced.',
 'uv': 'Full block faces use supplied original PNGs. Log grain axis is respected; partial-block UVs use block-local projections, not exact vanilla per-model UV templates.',
 'transparency': 'Supplied *_a masks used for glass, bars, webs, fire, torch and hatch. Only opaque box surfaces occlude other blocks; transparent cross planes have no volume.',
 'environment': 'Only crop blocks exported, not world biome data, entities, tile-entity contents, lighting, animations, collision or gameplay.'
}


class NBT:
    def __init__(self, data):
        self.data, self.pos = data, 0
    def unpack(self, fmt):
        n = struct.calcsize('>' + fmt)
        if self.pos + n > len(self.data): raise ValueError('Truncated NBT')
        v = struct.unpack_from('>' + fmt, self.data, self.pos)[0]
        self.pos += n
        return v
    def take(self, n):
        if n < 0 or self.pos + n > len(self.data): raise ValueError('Invalid NBT length')
        v = self.data[self.pos:self.pos+n]; self.pos += n
        return v
    def string(self): return self.take(self.unpack('H')).decode('utf-8', 'replace')
    def tag(self, t, depth=0):
        if depth > 100: raise ValueError('NBT nesting too deep')
        if t in (1, 2, 3, 4, 5, 6): return self.unpack({1:'b',2:'h',3:'i',4:'q',5:'f',6:'d'}[t])
        if t == 7: return self.take(self.unpack('i'))
        if t == 8: return self.string()
        if t == 9:
            kind, n = self.unpack('B'), self.unpack('i')
            if not 0 <= n <= 1000000: raise ValueError('Oversized NBT list')
            return [self.tag(kind, depth+1) for _ in range(n)]
        if t == 10:
            out = {}
            while True:
                kind = self.unpack('B')
                if kind == 0: return out
                key = self.string(); out[key] = self.tag(kind, depth+1)
        if t in (11, 12):
            n = self.unpack('i')
            if not 0 <= n <= 1000000: raise ValueError('Oversized NBT array')
            return [self.unpack('i' if t == 11 else 'q') for _ in range(n)]
        raise ValueError(f'Unsupported NBT tag {t}')
    def root(self):
        kind = self.unpack('B'); self.string()
        return self.tag(kind)


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def box(x0=0, y0=0, z0=0, x1=1, y1=1, z1=1): return (x0,y0,z0,x1,y1,z1)
def rotate_boxes(boxes, turns):
    for _ in range(turns % 4):
        boxes = [(1-b[5], b[1], b[0], 1-b[2], b[4], b[3]) for b in boxes]
    return boxes


def material_for(b, m, axis, sign):
    if b == 1: return 'stone'
    if b == 2: return 'dirt_grass_top' if axis == 1 and sign > 0 else ('dirt' if axis == 1 else 'dirt_grass_side')
    if b == 3: return 'dirt'
    if b in (4, 67, 139): return 'cobblestone'
    if b in (5, 125, 126): return 'plank_' + WOOD[m & 7]
    if b in (17, 162):
        kind = ['oak','spruce','birch','jungle'][m & 3] if b == 17 else ['acacia','big_oak'][m & 1]
        orientation = {0:1, 4:0, 8:2, 12:-1}[m & 12]
        return 'log_' + kind + ('_top' if axis == orientation else '_side')
    if b in STAIRS: return STAIRS[b]
    if b == 35: return 'wool_white'
    if b == 42: return 'iron_block'
    if b in (43,44):
        v = m & 7
        if v == 0: return 'stone_slab_top' if axis == 1 or (b == 43 and m & 8) else 'stone_slab_side'
        return {3:'cobblestone',5:'stone_brick'}[v]
    if b == 49: return 'obsidian'
    if b == 87: return 'netherrack'
    if b == 97: return 'stone_brick'  # all source metadata 2: infested stone brick
    if b == 98: return ['stone_brick','stone_brick_mossy','stone_brick_cracked','stone_brick_circle'][m & 3]
    if b == 123: return 'redstone_lamp_off'
    if b == 173: return 'coal_block'
    if b in (85,107,143): return 'plank_oak'
    if b == 113: return 'nether_brick'
    if b == 101: return 'iron_bars'
    if b == 160: return {1:'glass_orange',14:'glass_red',15:'glass_black'}[m & 15]
    if b == 96: return 'hatch'
    if b == 145: return 'anvil_top_1' if axis == 1 and sign > 0 else 'anvil_side'
    if b == 154: return 'hopper_top' if axis == 1 and sign > 0 else 'hopper_outside'
    if b == 33: return 'piston_bottom' if axis == 1 else 'piston_side'
    if b == 68: return 'sign'
    if b == 72: return 'plank_oak'
    if b == 131: return 'tripwire_hook'
    if b == 69: return 'lever'
    raise ValueError(f'No material for ID {b}:{m}')


def shape(pos, blocks):
    b, m = blocks[pos]; x,y,z = pos
    def neighbor(dx,dz): return blocks.get((x+dx,y,z+dz),(0,0))
    def connects(dx,dz, ids):
        other = neighbor(dx,dz)[0]
        return other in FULL or other in ids
    if b in FULL: return [box()]
    if b in (44,126): return [box(y0=.5 if m & 8 else 0, y1=1 if m & 8 else .5)]
    if b in STAIRS:
        d = m & 3; dx,dz = DIRECTIONS[d]; upper = bool(m & 4)
        quarters = {(i,k) for i in range(2) for k in range(2) if (i == (1 if dx > 0 else 0) if dx else k == (1 if dz > 0 else 0))}
        front = neighbor(dx,dz); back = neighbor(-dx,-dz)
        if front[0] in STAIRS and bool(front[1] & 4) == upper and (front[1] & 3)//2 != d//2:
            fx,fz = DIRECTIONS[front[1] & 3]
            quarters &= {(i,k) for i in range(2) for k in range(2) if (i == (1 if fx > 0 else 0) if fx else k == (1 if fz > 0 else 0))}
        elif back[0] in STAIRS and bool(back[1] & 4) == upper and (back[1] & 3)//2 != d//2:
            fx,fz = DIRECTIONS[back[1] & 3]
            quarters |= {(i,k) for i in range(2) for k in range(2) if (i == (1 if fx > 0 else 0) if fx else k == (1 if fz > 0 else 0))}
        base = [box(y0=.5 if upper else 0, y1=1 if upper else .5)]
        return base + [box(i*.5,0 if upper else .5,k*.5,(i+1)*.5,.5 if upper else 1,(k+1)*.5) for i,k in sorted(quarters)]
    if b in (85,113,139):
        wall = b == 139; lo,hi = (.25,.75) if wall else (.375,.625)
        result = [box(lo,0,lo,hi,1,hi)]
        for dx,dz in DIRECTIONS:
            if not connects(dx,dz,{b,107}): continue
            spans = [(0,.8125)] if wall else [(.375,.5625),(.75,.9375)]
            for y0,y1 in spans:
                if dx: result.append(box(0 if dx<0 else hi,y0,lo,lo if dx<0 else 1,y1,hi))
                else: result.append(box(lo,y0,0 if dz<0 else hi,hi,y1,lo if dz<0 else 1))
        return result
    if b in (101,160):
        lo,hi = .46875,.53125
        flags = [connects(dx,dz,{101,160}) for dx,dz in DIRECTIONS]
        if not any(flags): flags = [True]*4
        result = [box(lo,0,lo,hi,1,hi)]
        for (dx,dz),yes in zip(DIRECTIONS,flags):
            if not yes: continue
            if dx: result.append(box(0 if dx<0 else hi,0,lo,lo if dx<0 else 1,1,hi))
            else: result.append(box(lo,0,0 if dz<0 else hi,hi,1,lo if dz<0 else 1))
        return result
    if b == 96:
        if not m & 4: return [box(y0=.8125 if m & 8 else 0,y1=1 if m & 8 else .1875)]
        return [[box(z0=.8125)],[box(z1=.1875)],[box(x0=.8125)],[box(x1=.1875)]][m & 3]
    if b == 107:
        result = [box(.0,0,.4375,.125,1,.5625),box(.875,0,.4375,1,1,.5625)]
        if not m & 4:
            result += [box(.125,.375,.4375,.875,.5625,.5625),box(.125,.75,.4375,.875,.9375,.5625),box(.4375,.375,.4375,.5625,.9375,.5625)]
        else:
            result += [box(.0,.375,.4375,.125,.9375,1),box(.875,.375,.4375,1,.9375,1)]
        return rotate_boxes(result,m & 1)
    if b == 143:
        # Metadata 1 east,2 west,3 south,4 north. Pressed thickness halves.
        thick = .0625 if m & 8 else .125
        return {1:[box(0,.375,.3125,thick,.625,.6875)],2:[box(1-thick,.375,.3125,1,.625,.6875)],3:[box(.3125,.375,0,.6875,.625,thick)],4:[box(.3125,.375,1-thick,.6875,.625,1)]}[m & 7]
    if b == 72: return [box(.0625,0,.0625,.9375,.03125 if m else .0625,.9375)]
    if b == 145:
        return rotate_boxes([box(.125,0,.125,.875,.25,.875),box(.3125,.25,.25,.6875,.625,.75),box(0,.625,.1875,1,1,.8125)],m & 1)
    if b == 154:
        result = [box(0,.625,0,1,1,.125),box(0,.625,.875,1,1,1),box(0,.625,.125,.125,1,.875),box(.875,.625,.125,1,1,.875),box(.25,.25,.25,.75,.625,.75)]
        facing = m & 7
        spout = {0:box(.375,0,.375,.625,.25,.625),2:box(.375,.25,0,.625,.5,.25),3:box(.375,.25,.75,.625,.5,1),4:box(0,.25,.375,.25,.5,.625),5:box(.75,.25,.375,1,.5,.625)}[facing]
        return result+[spout]
    if b == 68:
        return {2:[box(.0625,.25,.9375,.9375,.75,1)],3:[box(.0625,.25,0,.9375,.75,.0625)],4:[box(.9375,.25,.0625,1,.75,.9375)],5:[box(0,.25,.0625,.0625,.75,.9375)]}[m]
    if b == 131:
        return rotate_boxes([box(.375,.25,.875,.625,.75,1),box(.4375,.25,.5625,.5625,.4375,.875)],m & 3)
    if b == 69:
        side = m & 7
        base = [box(.25,0,.3125,.75,.1875,.6875),box(.4375,.1875,.4375,.5625,.625,.5625)]
        if side in (0,7): return [box(.25,.8125,.3125,.75,1,.6875),box(.4375,.375,.4375,.5625,.8125,.5625)]
        if side in (5,6): return rotate_boxes(base,side & 1)
        return rotate_boxes([box(.3125,.25,.875,.6875,.75,1),box(.4375,.375,.5,.5625,.625,.875)],{1:1,2:3,3:2,4:0}[side])
    if b in (30,50,51): return []
    raise ValueError(f'No shape for ID {b}:{m}')


def surfaces(boxes):
    """Exact union boundary of authored axis-aligned boxes; merge coplanar cells."""
    if not boxes: return []
    coords = [sorted({b[a] for b in boxes}|{b[a+3] for b in boxes}) for a in range(3)]
    occupied = set()
    for i in range(len(coords[0])-1):
        for j in range(len(coords[1])-1):
            for k in range(len(coords[2])-1):
                p = [(coords[a][q]+coords[a][q+1])/2 for a,q in enumerate((i,j,k))]
                if any(all(b[a] < p[a] < b[a+3] for a in range(3)) for b in boxes): occupied.add((i,j,k))
    planes = collections.defaultdict(set)
    for cell in occupied:
        for axis in range(3):
            uv = [a for a in range(3) if a != axis]
            for sign in (-1,1):
                n = list(cell); n[axis] += sign
                if tuple(n) not in occupied:
                    plane = cell[axis]+(sign>0)
                    planes[axis,sign,plane].add((cell[uv[0]],cell[uv[1]]))
    result=[]
    for (axis,sign,plane), cells in sorted(planes.items()):
        uv = [a for a in range(3) if a != axis]
        while cells:
            i,j=min(cells); i1=i+1
            while (i1,j) in cells: i1+=1
            j1=j+1
            while all((v,j1) in cells for v in range(i,i1)): j1+=1
            for u in range(i,i1):
                for v in range(j,j1): cells.remove((u,v))
            result.append((axis,sign,coords[axis][plane],(coords[uv[0]][i],coords[uv[1]][j],coords[uv[0]][i1],coords[uv[1]][j1])))
    return result


def subtract_rect(r,c):
    u0,v0,u1,v1=r; a,b,d,e=c
    a,b,d,e=max(u0,a),max(v0,b),min(u1,d),min(v1,e)
    if a>=d or b>=e: return [r]
    pieces=[(u0,v0,a,v1),(d,v0,u1,v1),(a,v0,d,b),(a,e,d,v1)]
    return [p for p in pieces if p[0]<p[2] and p[1]<p[3]]


def decode(args):
    src, textures, out = Path(args.source),Path(args.textures),Path(args.output)
    if out.exists() and any(out.iterdir()): raise ValueError('Decode output must be new or empty')
    out.mkdir(parents=True,exist_ok=True)
    export_path=src/'export.mc2obj'
    selection=json.loads(export_path.read_text(encoding='utf-8'))
    if selection != {'dimension':0,'area':{'y':[49,113],'x':[-198,-291],'z':[606,510]}}: raise ValueError('Unexpected audited crop selection')
    xmin,xmax,ymin,ymax,zmin,zmax=CROP
    region_cache={}; hashes={str(export_path):sha(export_path)}; blocks={}; missing=[]; present=[]
    for cx in range(xmin//16,xmax//16+1):
        for cz in range(zmin//16,zmax//16+1):
            path=src/'region'/f'r.{cx//32}.{cz//32}.mca'
            if not path.is_file(): missing.append([cx,cz]); continue
            if path not in region_cache:
                region_cache[path]=path.read_bytes(); hashes[str(path)]=sha(path)
            raw=region_cache[path]; index=((cx%32)+(cz%32)*32)*4
            sector=int.from_bytes(raw[index:index+3],'big'); sector_count=raw[index+3]
            if not sector: missing.append([cx,cz]); continue
            off=sector*4096; length=int.from_bytes(raw[off:off+4],'big')
            if length<1 or length+4>sector_count*4096 or off+length+4>len(raw): raise ValueError('Invalid Anvil chunk length')
            compressed=raw[off+5:off+4+length]; compression=raw[off+4]
            if compression==1: payload=gzip.decompress(compressed)
            elif compression==2: payload=zlib.decompress(compressed)
            elif compression==3: payload=compressed
            else: raise ValueError(f'Unsupported Anvil compression {compression}')
            if len(payload)>16000000: raise ValueError('Oversized NBT payload')
            root=NBT(payload).root(); level=root.get('Level',root)
            if level.get('xPos')!=cx or level.get('zPos')!=cz: raise ValueError('Chunk coordinates do not match region index')
            present.append([cx,cz])
            for section in level.get('Sections',[]):
                sy=section['Y']; ids=section.get('Blocks',b''); metadata=section.get('Data',b''); adds=section.get('Add',b'')
                if not ids: continue
                if len(ids)!=4096 or len(metadata)!=2048: raise ValueError('Invalid legacy section arrays')
                for i,b in enumerate(ids):
                    x=cx*16+i%16; z=cz*16+(i//16)%16; y=sy*16+i//256
                    if not(xmin<=x<=xmax and ymin<=y<=ymax and zmin<=z<=zmax):continue
                    if adds:b+=((adds[i//2]>>(4*(i%2)))&15)*256
                    if b:blocks[x,y,z]=(b,(metadata[i//2]>>(4*(i%2)))&15)
    counts=collections.Counter(b for b,m in blocks.values()); unknown=sorted(set(counts)-KNOWN)
    if unknown: raise ValueError(f'Unknown source block IDs: {unknown}; conversion stopped rather than silently replacing')
    metadata_counts=collections.defaultdict(collections.Counter)
    for b,m in blocks.values(): metadata_counts[b][m]+=1
    shapes={p:shape(p,blocks) for p in blocks}
    cache={}; groups=collections.defaultdict(lambda:{'vertices':[],'faces':[],'uvs':[]})
    tiled_horizontal=collections.defaultdict(set)
    origin=((xmin+xmax+1)/2,ymin,(zmin+zmax+1)/2)
    removed=0
    def emit(p,verts,uvs,mat):
        if not (textures/(mat+'.png')).is_file():raise ValueError(f'Missing original supplied texture {mat}')
        g=groups[mat]; start=len(g['vertices'])
        g['vertices'].extend([[round(p[0]+v[0]-origin[0],6),round(-(p[2]+v[2]-origin[2]),6),round(p[1]+v[1]-origin[1],6)] for v in verts])
        g['uvs'].extend(uvs);g['faces'].append([start,start+1,start+2,start+3])
    for p,(b,m) in sorted(blocks.items()):
        if b in (30,50,51):
            mat={30:'cobweb',50:'torch',51:'fire'}[b]
            dx,dz=0,0
            if b==50 and m!=5:
                dx,dz={1:(-.22,0),2:(.22,0),3:(0,-.22),4:(0,.22)}[m]
            for reverse in (False,True):
                verts=[(dx,0,dz+(1 if reverse else 0)),(dx+1,0,dz+(0 if reverse else 1)),(dx+1,1,dz+(0 if reverse else 1)),(dx,1,dz+(1 if reverse else 0))]
                emit(p,verts,[(0,0),(1,0),(1,1),(0,1)],mat)
            continue
        key=tuple(shapes[p])
        if key not in cache:cache[key]=surfaces(key)
        for axis,sign,plane,rect in cache[key]:
            uvaxes=[a for a in range(3) if a!=axis]; pieces=[rect]
            if plane==(1 if sign>0 else 0):
                n=list(p);n[axis]+=sign;n=tuple(n)
                nb,nm=blocks.get(n,(0,0))
                # Glass/bar/hatch texture masks are not full occluders.
                opaque = nb not in (0,30,50,51,96,101,160)
                same_glass = b==160 and nb==160 and m==nm
                if opaque or same_glass:
                    edge=0 if sign>0 else 1
                    for c in shapes.get(n,[]):
                        if c[axis]<=edge<=c[axis+3]:
                            clip=(c[uvaxes[0]],c[uvaxes[1]],c[uvaxes[0]+3],c[uvaxes[1]+3])
                            pieces=[part for r in pieces for part in subtract_rect(r,clip)]
                if not pieces:removed+=1
            for u0,v0,u1,v1 in pieces:
                verts=[]
                for u,v in [(u0,v0),(u1,v0),(u1,v1),(u0,v1)]:
                    q=[0.,0.,0.];q[axis]=plane;q[uvaxes[0]]=u;q[uvaxes[1]]=v;verts.append(tuple(q))
                # Ascending plane-axis winding has normal +X, -Y, +Z.
                if sign != (-1 if axis==1 else 1):verts.reverse()
                tex=material_for(b,m,axis,sign)
                if b in FULL and axis==1 and (u0,v0,u1,v1)==(0,0,1,1):
                    tiled_horizontal[tex,sign,p[1]+plane].add((p[0],p[2]))
                    continue
                log_axis={0:1,4:0,8:2,12:-1}.get(m & 12) if b in (17,162) else None
                if log_axis is not None and log_axis>=0 and axis!=log_axis:
                    transverse=next(a for a in range(3) if a not in (axis,log_axis))
                    uv=[(q[transverse],q[log_axis]) for q in verts]
                elif axis==1:uv=[(q[0],1-q[2]) for q in verts]
                elif axis==0:uv=[(q[2] if sign>0 else 1-q[2],q[1]) for q in verts]
                else:uv=[(q[0] if sign<0 else 1-q[0],q[1]) for q in verts]
                emit(p,verts,uv,tex)
    merged_horizontal_cells=0; merged_horizontal_quads=0
    for (tex,sign,height), cells in sorted(tiled_horizontal.items()):
        merged_horizontal_cells+=len(cells)
        while cells:
            x,z=min(cells); x1=x+1
            while (x1,z) in cells:x1+=1
            z1=z+1
            while all((v,z1) in cells for v in range(x,x1)):z1+=1
            for u in range(x,x1):
                for v in range(z,z1):cells.remove((u,v))
            verts=[(x,height,z),(x1,height,z),(x1,height,z1),(x,height,z1)]
            if sign>0:verts.reverse()
            # Repeat the unmodified original texture once per source block.
            emit((0,0,0),verts,[(v[0]-x,z1-v[2]) for v in verts],tex)
            merged_horizontal_quads+=1
    quads=sum(len(g['faces']) for g in groups.values());triangles=quads*2
    if triangles>=250000:raise ValueError(f'Triangle budget exceeded: {triangles}; no GLB exported')
    above=[p for p in blocks if p[1]>ymin]
    def bounds(points):return {'min':[min(p[a] for p in points) for a in range(3)],'max':[max(p[a] for p in points)+1 for a in range(3)]}
    info={'source_world':str(src),'selection':selection,'crop_inclusive':{'x':[xmin,xmax],'y':[ymin,ymax],'z':[zmin,zmax]},'present_chunks':present,'missing_chunks':missing,'source_hashes':hashes,'source_preserved':all(sha(Path(p))==h for p,h in hashes.items()),'non_air_blocks':len(blocks),'blocks_above_y49':len(above),'block_counts':dict(sorted(counts.items())),'block_metadata_counts':{str(b):dict(sorted(v.items())) for b,v in sorted(metadata_counts.items())},'source_block_bounds_exclusive':bounds(list(blocks)),'above_base_bounds_exclusive':bounds(above),'coordinate_origin_minecraft':origin,'mesh_quads':quads,'mesh_triangles':triangles,'mesh_vertices_before_gltf':quads*4,'fully_occluded_authored_faces_removed':removed,'material_groups':len(groups),'original_textures_used':sorted(groups),'unsupported_ids':unknown,'limitations':LIMITATIONS,'scale_applied':1,'unit':'one Minecraft block','output_mesh_bounds_blender':bounds([v for g in groups.values() for v in g['vertices']])}
    # Mesh bounds are floating point coordinates, not integer block positions.
    verts=[v for g in groups.values() for v in g['vertices']]
    info['output_mesh_bounds_blender']={'min':[min(v[a] for v in verts) for a in range(3)],'max':[max(v[a] for v in verts) for a in range(3)]}
    (out/'mesh.json').write_text(json.dumps({'groups':dict(groups)},separators=(',',':')),encoding='utf-8')
    (out/'conversion.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
    print(json.dumps({k:info[k] for k in ('non_air_blocks','blocks_above_y49','mesh_triangles','material_groups','above_base_bounds_exclusive','source_preserved')},indent=2),flush=True)


def export(args):
    import bpy
    from mathutils import Vector
    out,textures=Path(args.output),Path(args.textures)
    payload=json.loads((out/'mesh.json').read_text(encoding='utf-8'))
    info=json.loads((out/'conversion.json').read_text(encoding='utf-8'))
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    objects=[]; image_audit={}
    for name,g in payload['groups'].items():
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(g['vertices'],[],g['faces']);mesh.update()
        obj=bpy.data.objects.new('Minecraft_'+name,mesh);bpy.context.collection.objects.link(obj);objects.append(obj)
        uv=mesh.uv_layers.new(name='UVMap')
        # Every authored face has four distinct vertices; no lossy topology merging.
        uv.data.foreach_set('uv',[c for poly in mesh.polygons for i in poly.vertices for c in g['uvs'][i]])
        mat=bpy.data.materials.new(name);mat.use_nodes=True;mat.use_backface_culling=False
        shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.95
        img=bpy.data.images.load(str(textures/(name+'.png')),check_existing=True)
        if not img.size[0]:raise ValueError(f'Cannot decode source PNG {name}')
        img.pack();node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=img;node.interpolation='Closest'
        mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
        audit={'path':str(textures/(name+'.png')),'dimensions':list(img.size),'sha256':sha(textures/(name+'.png'))}
        mask_path=textures/(name+'_a.png')
        if mask_path.is_file():
            mask=bpy.data.images.load(str(mask_path),check_existing=True);mask.colorspace_settings.name='Non-Color';mask.pack()
            masknode=mat.node_tree.nodes.new('ShaderNodeTexImage');masknode.image=mask;masknode.interpolation='Closest'
            separate=mat.node_tree.nodes.new('ShaderNodeSeparateColor');separate.mode='RGB';mat.node_tree.links.new(masknode.outputs['Color'],separate.inputs['Color'])
            mat.node_tree.links.new(separate.outputs['Red'],shader.inputs['Alpha']);mat.surface_render_method='DITHERED'
            audit['alpha_mask']={'path':str(mask_path),'dimensions':list(mask.size),'sha256':sha(mask_path)}
        mesh.materials.append(mat);image_audit[name]=audit
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    glb_path=out/'minecraft-crop.glb'
    bpy.ops.export_scene.gltf(filepath=str(glb_path),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False,export_animations=False,export_materials='EXPORT',export_yup=True,export_image_format='AUTO',export_texcoords=True,export_normals=True)
    raw=glb_path.read_bytes();magic,version,total=struct.unpack_from('<III',raw)
    if magic!=0x46546c67 or version!=2 or total!=len(raw):raise ValueError('Invalid GLB container')
    n,kind=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+n])
    if doc.get('cameras') or 'KHR_lights_punctual' in doc.get('extensions',{}):raise ValueError('Unexpected camera/light in GLB')
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    if triangles!=info['mesh_triangles'] or triangles>=250000:raise ValueError('GLB geometry budget/check mismatch')
    info.update({'glb_path':str(glb_path),'glb_bytes':len(raw),'glb_sha256':sha(glb_path),'glb_triangles_verified':triangles,'glb_meshes':len(doc['meshes']),'glb_materials':len(doc.get('materials',[])),'glb_images':len(doc.get('images',[])),'glb_cameras':len(doc.get('cameras',[])),'glb_lights':0,'texture_audit':image_audit,'blender_version':bpy.app.version_string,'source_preserved':all(sha(Path(p))==h for p,h in info['source_hashes'].items())})
    if not info['source_preserved']:raise ValueError('Source hash changed during conversion')
    (out/'conversion.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
    print(json.dumps({k:info[k] for k in ('glb_path','glb_bytes','glb_triangles_verified','glb_meshes','glb_images','source_preserved')},indent=2),flush=True)
    if args.render:
        scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
        scene.render.resolution_x=1000;scene.render.resolution_y=900;scene.render.resolution_percentage=100
        scene.world.color=(.32,.32,.32)
        lower=Vector(info['output_mesh_bounds_blender']['min']);upper=Vector(info['output_mesh_bounds_blender']['max']);target=(lower+upper)*.5
        # Review-only cameras/lights are created AFTER mesh-only GLB export.
        for suffix,direction in [('front',(1.25,-1.45,1.15)),('back',(-1.25,1.45,1.05))]:
            camera_data=bpy.data.cameras.new('review');camera=bpy.data.objects.new('review',camera_data);scene.collection.objects.link(camera)
            camera.location=target+Vector(direction)*85;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=136;scene.camera=camera
            light_data=bpy.data.lights.new('review_sun','SUN');light_data.energy=2.7;light=bpy.data.objects.new('review_sun',light_data);scene.collection.objects.link(light);light.rotation_euler=(.35,-.5,-.35)
            scene.render.filepath=str(out/f'review-{suffix}.png');bpy.ops.render.render(write_still=True)
            bpy.data.objects.remove(camera,do_unlink=True);bpy.data.objects.remove(light,do_unlink=True)


def main():
    argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
    parser=argparse.ArgumentParser();parser.add_argument('phase',choices=['decode','export']);parser.add_argument('--source');parser.add_argument('--textures',required=True);parser.add_argument('--output',required=True);parser.add_argument('--render',action='store_true')
    args=parser.parse_args(argv)
    if args.phase=='decode':decode(args)
    else:export(args)
if __name__=='__main__':main()

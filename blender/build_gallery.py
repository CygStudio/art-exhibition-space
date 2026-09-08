"""Run: blender --background --python blender/build_gallery.py"""
import bpy
import math
import json
import random
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
random.seed(28)

def mat(name, color, rough=0.85, metal=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    return m

plaster = mat('Warm plaster', (.72,.70,.65))
steel = mat('Painted structural steel', (.54,.55,.51), .7)
panel = mat('Exhibition panels', (.84,.82,.77))
dark = mat('Charcoal metal', (.026,.031,.029), .55, .3)
seam = mat('Panel seams', (.48,.47,.43))
cloth = mat('Ochre table linen', (.48,.39,.25))
white = mat('Paper labels', (.93,.9,.81))
concrete = mat('Concrete', (.5,.48,.43))
lightmat = mat('Lamp diffuser', (1,.92,.7))
bs = next(n for n in lightmat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bs.inputs['Emission Color'].default_value = (1,.88,.6,1)
bs.inputs['Emission Strength'].default_value = 2

# A small, deterministic raster material; packed into both .blend and .glb.
rng = np.random.default_rng(28)
n = 512
yy, xx = np.mgrid[0:n,0:n]
noise = rng.normal(0,.012,(n,n))
for scale, strength in [(17,.016),(51,.011),(123,.007)]:
    noise += np.sin(xx/scale + np.cos(yy/(scale*.8)))*strength
rgba = np.ones((n,n,4), dtype=np.float32)
for c, base in enumerate([.49,.475,.445]): rgba[:,:,c] = np.clip(base+noise,0,1)
tex = bpy.data.images.new('Concrete mottling 512', width=n, height=n)
tex.pixels.foreach_set(rgba.ravel())
tex.pack()
node = concrete.node_tree.nodes.new('ShaderNodeTexImage')
node.image = tex
concrete.node_tree.links.new(node.outputs['Color'], next(n for n in concrete.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'])

static = []
colliders = []
def xyz(p): return (p[0], -p[2], p[1])
def box(name, pos, size, material, merge=True, collision=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(pos))
    o=bpy.context.object
    o.name=name
    o.dimensions=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    if merge: static.append(o)
    if collision: colliders.append({'x':pos[0], 'z':pos[2], 'width':size[0], 'depth':size[2]})
    return o

def rod(name, start, end, radius, material):
    a,b=Vector(xyz(start)),Vector(xyz(end))
    bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=radius,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object; o.name=name
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    o.data.materials.append(material); static.append(o)
    return o

box('Floor slab',(0,-.1,0),(10.3,.2,12.3),concrete)
box('Ceiling',(0,3.22,0),(10.3,.12,12.3),plaster)
box('Back plaster wall',(0,1.55,-6),(10.2,3.1,.18),plaster)
box('West plaster wall',(-5,1.55,0),(.18,3.1,12),plaster)
box('East plaster wall',(5,1.55,0),(.18,3.1,12),plaster)
box('Entry wall left',(-3.3,1.55,6),(3.4,3.1,.18),plaster)
box('Entry wall right',(4.15,1.55,6),(1.7,3.1,.18),plaster)
box('Entry lintel',(.85,2.8,6),(5.3,.65,.18),plaster)
for x in [-.6,2.15]:
    box('Black entry door',(x,1.17,5.98),(2.35,2.34,.1),dark)
    for dx in [-1.1,1.1]: box('Door jamb',(x+dx,1.2,5.9),(.04,2.4,.1),steel)
    box('Door rail',(x,1.0,5.89),(2.2,.04,.05),steel)
    rod('Door handle',(x+.5,.9,5.80),(x+.5,1.3,5.80),.016,white)
box('Door pier',(.77,1.57,5.83),(.42,3.14,.38),plaster,collision=True)
for z in [-1.45,3.65]:
    box('Square structural column',(-1.35,1.57,z),(.48,3.14,.5),plaster,collision=True)
    box('Column foot',(-1.35,.11,z),(.54,.22,.56),steel)
    rod('Column conduit',(-1.07,.15,z+.25),(-1.07,2.8,z+.25),.012,steel)
    box('Column socket',(-1.06,.3,z+.28),(.10,.13,.05),dark)
for z in [-5.6+i*.69 for i in range(17)]:
    box('Exposed transverse joist',(0,3.03,z),(10,.25,.12),steel)
for x in [-3.5,-1.35,2.6]:
    box('Longitudinal beam',(x,2.92,0),(.19,.34,12),plaster)
for x in [-4.1,3.95]:
    rod('Service pipe',(x,2.77,-5.95),(x,2.77,5.95),.045,steel)
    box('Lighting track',(x,2.85,0),(.045,.04,11.8),dark)
for z in [-4.3,2.2]:
    rod('Cross pipe',(-4.95,2.72,z),(4.95,2.72,z),.037,plaster)
for z in [-3.3,3.7]:
    box('Air conditioner',(4.46,2.88,z),(.8,.34,1.7),plaster)
    box('Air conditioner grille',(4.02,2.85,z),(.03,.21,1.56),dark)
    for i in range(7): box('Vent fin',(3.997,2.76+i*.03,z),(.025,.011,1.55),steel)

# Discrete sheet seams and the lower exhibition wall height seen in the references.
for side in [-1,1]:
    for i in range(10):
        z=-5.4+i*1.2
        box('Wall panel',(side*4.86,1.26,z),(.09,2.52,1.195),panel)
    for z in [-4,0,4]:
        box('Outlet',(side*4.796,.28,z),(.035,.075,.12),white)
for x in [-4.4+i*1.1 for i in range(9)]:
    box('Rear skirting',(x,.085,-5.87),(1.09,.17,.07),steel)

# Reception corner, without visitors or character cutouts.
box('Reception table',(3.4,.4,4.75),(2.25,.8,.82),cloth,collision=True)
box('Reception tabletop',(3.4,.81,4.75),(2.3,.04,.88),cloth)
for i in range(15): box('Linen folds',(2.3+i*.15,.38,4.325),(.022,.71,.02),cloth)
box('Guestbook',(2.9,.844,4.7),(.42,.024,.3),white)
box('Display plinth',(4.17,1.05,4.73),(.45,.46,.43),dark)
for x in [2.6,3.7]:
    box('Folding chair seat',(x,.43,5.38),(.4,.055,.38),dark)
    box('Folding chair back',(x,.72,5.52),(.4,.22,.04),dark)
    for dx in [-.17,.17]:
        rod('Chair leg',(x+dx,.04,5.2),(x+dx,.7,5.55),.017,dark)
        rod('Chair leg',(x+dx,.04,5.57),(x+dx,.43,5.21),.017,dark)

arts=[]
titles=['光的序章','緋色軌跡','日落之後','靜謐之境','月的背面','流動的記憶','微光之間','夜色練習','熙望的形狀','盛放','遠方來信','光與回聲','留下的溫度','浮光','時間切片','未完的風景','相遇時刻','日光收藏','柔軟的邊界','再次，看見','熙望・序曲']
palettes=[['#e5d9c5','#b84f3d','#292c35','#c99567'],['#dddace','#364a50','#a48a66','#ecb666'],['#ebe0d0','#723642','#c78072','#303241'],['#d2d7cc','#647d71','#c7a36e','#283a38']]
def art(pos,w,h,rot,zone):
    idx=len(arts)+1; ident=f'{idx:02}'
    # Thin framed panel, front is local +Z; rotation about Three.js Y.
    a=math.radians(rot)
    def local(dx,dy,dz): return (pos[0]+dx*math.cos(a)+dz*math.sin(a),pos[1]+dy,pos[2]-dx*math.sin(a)+dz*math.cos(a))
    frame=box('Frame_'+ident,local(0,0,-.025),(w+.055,h+.055,.065),dark)
    frame.rotation_euler.z=a
    # Front plane is generated directly for precise UV orientation.
    verts=[xyz(local(-w/2,-h/2,.013)),xyz(local(w/2,-h/2,.013)),xyz(local(w/2,h/2,.013)),xyz(local(-w/2,h/2,.013))]
    mesh=bpy.data.meshes.new('Canvas_'+ident); mesh.from_pydata(verts,[],[(0,1,2,3)]); mesh.update()
    uv=mesh.uv_layers.new()
    for i,co in enumerate([(0,0),(1,0),(1,1),(0,1)]): uv.data[i].uv=co
    obj=bpy.data.objects.new('Artwork_'+ident,mesh); bpy.context.collection.objects.link(obj)
    obj.data.materials.append(white); obj['artworkId']=ident
    label=box('Label_'+ident,local(0,-h/2-.095,0),(.2,.045,.013),white)
    label.rotation_euler.z=a
    # Hanging wires continue above each frame.
    for dx in [-w*.32,w*.32]: rod('Picture wire',local(dx,h/2+.02,-.02),local(dx,2.53-pos[1],-.02),.003,steel)
    p=palettes[(idx-1)%len(palettes)]
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900"><rect width="720" height="900" fill="{p[0]}"/><defs><pattern id="lines" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 0V12" stroke="{p[3]}" stroke-opacity=".18"/></pattern></defs><rect x="38" y="38" width="644" height="824" fill="url(#lines)"/><circle cx="{245+idx%3*90}" cy="320" r="{155+idx%4*12}" fill="{p[1]}"/><path d="M90 780V490a180 180 0 0 1 360 0v290Z" fill="{p[2]}"/><path d="M310 780V530a150 150 0 0 1 300 0v250Z" fill="{p[3]}"/><circle cx="505" cy="205" r="58" fill="{p[0]}"/><path d="M50 {590+idx%5*22} Q340 270 655 670 M70 810 Q320 510 670 720" fill="none" stroke="{p[0]}" stroke-width="3"/><text x="55" y="85" fill="{p[2]}" font-family="serif" font-size="22" letter-spacing="5">STUDY / {ident}</text><text x="55" y="855" fill="{p[2]}" font-family="sans-serif" font-size="12" letter-spacing="4">LIGHT &amp; MEMORY — PLACEHOLDER</text></svg>'''
    (OUT/'artworks'/f'{ident}.svg').write_text(svg)
    arts.append({'id':ident,'title':titles[idx-1],'zone':zone,'image':f'artworks/{ident}.svg','position':list(pos),'rotation':rot,'width':w,'height':h,'description':'以色塊、弧線與留白，練習光與記憶之間的關係。這是為空間導覽製作的示意作品，並非原展覽畫作。','medium':'數位構成・示意圖'})
    start=local(0,2.69-pos[1],1.0); end=local(0,2.52-pos[1],.84)
    rod('Spotlight housing',start,end,.055,steel)
    rod('Spotlight lens',end,local(0,2.51-pos[1],.83),.047,lightmat)

for i in range(7): art((-4.785,1.72,-4.8+i*1.45),.78 if i%3 else 1.03,.98 if i%3 else .74,90,'west')
for i in range(6): art((4.785,1.72,-4.85+i*1.45),.82 if i%2 else .96,1.02 if i%2 else .78,-90,'east')
for i in range(7): art((-4.12+i*1.35,1.72,-5.865),.85 if i%2 else 1.04,1.0 if i%2 else .74,0,'north')
art((3.5,1.85,5.83),2.15,1.25,180,'reception')

# Merge architectural pieces per material to keep web draw calls small.
for material in list(bpy.data.materials):
    objects=[o for o in static if o.data.materials[0]==material]
    if not objects: continue
    static = [o for o in static if o not in objects]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    objects[0].name='Architecture_'+material.name.replace(' ','_')

scene=bpy.context.scene
scene.world.color=(.4,.4,.4)
# Camera retained in source for easy inspection, excluded from web export.
bpy.ops.object.camera_add(location=xyz((1.3,1.65,4.0)))
cam=bpy.context.object; cam.name='Entrance preview'
cam.rotation_euler=(Vector(xyz((-.6,1.65,-4)))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.lens=22; scene.camera=cam
for p in [(-2,2.6,-3),(2,2.6,2)]:
    bpy.ops.object.light_add(type='AREA',location=xyz(p))
    bpy.context.object.data.energy=350
    bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=5
scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.render.resolution_x=1440; scene.render.resolution_y=900; scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender'/'gallery.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'models'/'gallery.glb'),export_format='GLB',export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
(OUT/'gallery.json').write_text(json.dumps({'artworks':arts,'colliders':colliders,'bounds':{'minX':-4.55,'maxX':4.55,'minZ':-5.5,'maxZ':5.45}},ensure_ascii=False,indent=2))
triangles=sum(len(o.data.polygons) for o in bpy.data.objects if o.type=='MESH')
print(f'Gallery exported: {len(arts)} artworks, {triangles} polygons, {(OUT/"models"/"gallery.glb").stat().st_size} bytes')

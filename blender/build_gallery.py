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
glass = mat('Window glass', (.32,.43,.49), .15)
glass.diffuse_color = (.32,.43,.49,.32)
glass.surface_render_method = 'DITHERED'
next(n for n in glass.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Alpha'].default_value = .32
exterior = mat('Exterior ambient', (.28,.34,.42))
accent = mat('Exhibition accent', (.68,.37,.43))
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
    if collision: colliders.append({'name':name, 'x':pos[0], 'z':pos[2], 'width':size[0], 'depth':size[2]})
    return o

def rod(name, start, end, radius, material):
    a,b=Vector(xyz(start)),Vector(xyz(end))
    bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=radius,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object; o.name=name
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    o.data.materials.append(material); static.append(o)
    return o

# Coordinates follow the annotated plan: top is -Z, right is +X.
layout = {
    'outer': {'minX':-5.4,'maxX':5.4,'minZ':-5.1,'maxZ':5.1},
    'unusedRoom': {'x':3.725,'z':-3.375,'width':3.35,'depth':3.45},
    'serviceDesk': {'x':.075,'z':-3.95,'width':3.25,'depth':.82},
    'guestbook': {'x':-3.8,'z':-4.55,'width':2.8,'depth':.72},
    'window': {'x':5.4,'z':2.45,'width':.12,'depth':4.5},
    'entrance': {'position':[3.9,1.65,-.35],'yaw':.95},
    'columns': [{'x':-1.25,'z':z,'width':.48,'depth':.5} for z in [-2.94,3.0]],
}
box('Floor slab',(0,-.1,0),(11,.2,10.4),concrete)
box('Ceiling',(0,3.22,0),(11,.12,10.4),plaster)
box('North plaster wall',(0,1.55,-5.1),(10.8,3.1,.18),plaster)
box('South plaster wall',(0,1.55,5.1),(10.8,3.1,.18),plaster)
box('West plaster wall',(-5.4,1.55,0),(.18,3.1,10.2),plaster)
# Only the short solid portions remain on the window side.
box('East wall above glazing',(5.4,1.55,-2.45),(.18,3.1,5.3),plaster)
box('East wall below glazing',(5.4,1.55,4.9),(.18,3.1,.4),plaster)
box('Window lintel',(5.4,2.99,2.45),(.2,.22,4.5),plaster)
box('Window sill',(5.4,.035,2.45),(.24,.07,4.5),dark)
for z in [.2,1.325,2.45,3.575,4.7]:
    box('Window mullion',(5.34,1.46,z),(.14,2.92,.065),dark)
for y in [.07,.95,2.88]:
    box('Window horizontal frame',(5.34,y,2.45),(.14,.05,4.5),dark)
for z in [.7625,1.8875,3.0125,4.1375]:
    box('Exterior window pane',(5.38,1.47,z),(.025,2.8,1.06),glass,merge=False)
box('Exterior ambient backdrop',(5.7,1.5,2.45),(.02,3.1,4.5),exterior)
# A plain inset entry remains provisional: its exact position is not confirmed.
box('Provisional entry door',(5.285,1.14,-.75),(.05,2.28,1.1),dark)
rod('Entry handle',(5.24,.9,-1.1),(5.24,1.25,-1.1),.016,steel)

# The unused room is a physical enclosure and a fully blocked navigation area.
r=layout['unusedRoom']
colliders.append({'name':'Unused room',**r,'width':r['width']+.16,'depth':r['depth']+.16})
box('Unused room west partition',(2.05,1.55,-3.375),(.16,3.1,3.45),panel)
box('Unused room south partition',(3.725,1.55,-1.65),(3.35,3.1,.16),panel)
box('Closed unused room door',(2.6,1.12,-1.748),(.85,2.24,.04),plaster)
for x in [2.15,3.05]: box('Closed door jamb',(x,1.14,-1.79),(.04,2.28,.06),steel)
box('Closed door header',(2.6,2.28,-1.79),(.94,.04,.06),steel)
rod('Closed door handle',(2.92,.96,-1.81),(2.92,1.12,-1.81),.012,dark)
for c in layout['columns']:
    x,z=c['x'],c['z']
    box('Square structural column',(x,1.57,z),(.48,3.14,.5),plaster,collision=True)
    box('Column foot',(x,.11,z),(.54,.22,.56),steel)
    rod('Column conduit',(x+.28,.15,z+.25),(x+.28,2.8,z+.25),.012,steel)
    box('Column socket',(x+.29,.3,z+.28),(.10,.13,.05),dark)
for z in [-4.8+i*.64 for i in range(16)]:
    box('Exposed transverse joist',(0,3.03,z),(10.8,.25,.12),steel)
for x in [-3.5,-1.25,2.6]:
    box('Longitudinal beam',(x,2.92,0),(.19,.34,10.2),plaster)
for x in [-4.5,4.4]:
    rod('Service pipe',(x,2.77,-5.05),(x,2.77,5.05),.045,steel)
    box('Lighting track',(x,2.85,0),(.045,.04,10),dark)
for z in [-4.3,2.2]:
    rod('Cross pipe',(-5.35,2.72,z),(5.35,2.72,z),.037,plaster)
for z in [-.7,3.7]:
    box('Air conditioner',(4.8,2.88,z),(.8,.34,1.4),plaster)
    box('Air conditioner grille',(4.36,2.85,z),(.03,.21,1.3),dark)
    for i in range(7): box('Vent fin',(4.337,2.76+i*.03,z),(.025,.011,1.3),steel)

# Continuous exhibition walls on the left and bottom, never across the glazing.
for i in range(9):
    box('West exhibition panel',(-5.26,1.26,-4.53+i*1.13),(.09,2.52,1.125),panel)
    box('South exhibition panel',(-4.8+i*1.2,1.26,4.96),(1.195,2.52,.09),panel)
for z in [-3,0,3]: box('Outlet',(-5.196,.28,z),(.035,.075,.12),white)
box('West exhibition ribbon',(-5.204,1.45,0),(.012,.018,10.1),accent)
box('South exhibition ribbon',(0,1.45,4.904),(10.6,.018,.012),accent)

# Separate visitor signing desk and staffed service counter, in the marked areas.
def draped_table(name, footprint):
    x,z,w,d=footprint['x'],footprint['z'],footprint['width'],footprint['depth']
    box(name,(x,.4,z),(w,.8,d),cloth,merge=False,collision=True)
    box(name+' top',(x,.82,z),(w+.05,.04,d+.04),cloth)
    for i in range(int(w/.15)):
        box('Linen fold',(x-w/2+.06+i*.15,.4,z+d/2+.014),(.022,.73,.023),cloth)

def chair(x,z,facing=1):
    box('Folding chair seat',(x,.43,z),(.42,.055,.4),dark)
    box('Folding chair back',(x,.75,z-facing*.18),(.42,.24,.045),dark)
    colliders.append({'name':'Folding chair','x':x,'z':z,'width':.46,'depth':.48})
    for dx in [-.17,.17]:
        rod('Chair leg',(x+dx,.04,z-.2),(x+dx,.72,z+.2),.017,dark)
        rod('Chair leg',(x+dx,.04,z+.2),(x+dx,.43,z-.2),.017,dark)

draped_table('Staff service counter',layout['serviceDesk'])
for x in [-.7,.85]: chair(x,-4.72)
box('Service display equipment',(1.06,1.12,-3.97),(.46,.55,.4),dark)
box('Service display face',(1.06,1.13,-3.758),(.37,.4,.018),accent)
for x in [-1.08,-.65,-.22]:
    box('Counter display stand',(x,.89,-3.93),(.28,.09,.21),white)
    box('Counter display card',(x,1.05,-4),(.24,.25,.025),accent)
box('Service papers',(.35,.86,-3.8),(.33,.035,.25),white)

draped_table('Guestbook table',layout['guestbook'])
box('Guestbook cover',(-3.8,.85,-4.4),(.65,.025,.4),dark)
for x in [-3.955,-3.645]:
    box('Open guestbook page',(x,.869,-4.4),(.305,.013,.375),white)
    for i in range(5): box('Guestbook writing line',(x,.877,-4.53+i*.057),(.24,.002,.003),seam)
rod('Guestbook spine',(-3.8,.88,-4.58),(-3.8,.88,-4.22),.008,cloth)
rod('Signing pen',(-3.26,.868,-4.49),(-3.2,.868,-4.29),.012,dark)
chair(-4.65,-3.65,-1)

arts=[]
titles=['光的序章','緋色軌跡','日落之後','靜謐之境','月的背面','流動的記憶','微光之間','夜色練習','熙望的形狀','盛放','遠方來信','光與回聲','留下的溫度','浮光','時間切片','未完的風景','相遇時刻','日光收藏','柔軟的邊界','再次，看見','熙望・序曲']
palettes=[['#e5d9c5','#b84f3d','#292c35','#c99567'],['#dddace','#364a50','#a48a66','#ecb666'],['#ebe0d0','#723642','#c78072','#303241'],['#d2d7cc','#647d71','#c7a36e','#283a38']]
def art(pos,w,h,rot,zone,view_position=None):
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
    if view_position is not None: arts[-1]['viewPosition'] = view_position
    start=local(0,2.69-pos[1],1.0); end=local(0,2.52-pos[1],.84)
    rod('Spotlight housing',start,end,.055,steel)
    rod('Spotlight lens',end,local(0,2.51-pos[1],.83),.047,lightmat)

for i in range(7): art((-5.185,1.72,-3.2+i*1.17),.78 if i%3 else 1.03,.98 if i%3 else .74,90,'west')
for i in range(7):
    x=-4.4+i*1.45
    art((x,1.72,4.885),.82 if i%2 else .96,1.02 if i%2 else .78,180,'south',[x,1.65,3.8] if i==2 else None)
for x in [3.42,4.18,4.93]: art((x,1.72,-1.545),.58,.8,0,'east')
for x in [-4.6,-3.55,-2.5]: art((x,1.85,-4.965),.75,.9,0,'guestbook',[x,1.65,-2.7])
art((.1,1.87,-4.965),2.7,1.25,0,'reception',[.1,1.65,-2.2])

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
bpy.ops.object.camera_add(location=xyz(layout['entrance']['position']))
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
(OUT/'gallery.json').write_text(json.dumps({'artworks':arts,'colliders':colliders,'bounds':{'minX':-4.95,'maxX':4.95,'minZ':-4.65,'maxZ':4.65},'layout':layout},ensure_ascii=False,indent=2))
triangles=sum(len(o.data.polygons) for o in bpy.data.objects if o.type=='MESH')
print(f'Gallery exported: {len(arts)} artworks, {triangles} polygons, {(OUT/"models"/"gallery.glb").stat().st_size} bytes')

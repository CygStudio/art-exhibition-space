"""Run: blender --background --python blender/build_gallery.py"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

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
north, south = -6.3, 6.3
room_depth = south - north
layout = {
    'outer': {'minX':-5.4,'maxX':5.4,'minZ':north,'maxZ':south},
    'entranceLobby': {'x':3.725,'z':(north-1.65)/2,'width':3.35,'depth':-1.65-north},
    'serviceDesk': {'x':.15,'z':-4.85,'width':3.4,'depth':1.08},
    'guestbook': {'x':-3.85,'z':-5.72,'width':2.65,'depth':.82},
    'window': {'x':5.4,'z':3.625,'width':.12,'depth':4.55},
    'entrance': {'position':[1.45,1.65,-2.45],'yaw':math.pi/2,'door':{'x':2.05,'z':-2.45,'width':1.05,'height':2.25,'wall':'west'}},
    'heightRuler': {'x':-.953,'z':-2.77,'minCm':0,'maxCm':180},
    'columns': [{'x':-1.25,'z':z,'width':.48,'depth':.5} for z in [-2.94,3.0]],
}
box('Floor slab',(0,-.1,0),(11,.2,room_depth+.2),concrete)
box('Ceiling',(0,3.22,0),(11,.12,room_depth+.2),plaster)
box('North plaster wall',(0,1.55,north),(10.8,3.1,.18),plaster)
box('South plaster wall',(0,1.55,south),(10.8,3.1,.18),plaster)
box('West plaster wall',(-5.4,1.55,0),(.18,3.1,room_depth),plaster)
# Only the short solid portions remain on the window side.
box('East wall above glazing',(5.4,1.55,(north+1.35)/2),(.18,3.1,1.35-north),plaster)
box('East wall below glazing',(5.4,1.55,south-.2),(.18,3.1,.4),plaster)
window = layout['window']
window_start = window['z'] - window['depth']/2
pane_width = window['depth']/4
box('Window lintel',(5.4,2.99,window['z']),(.2,.22,window['depth']),plaster)
box('Window sill',(5.4,.035,window['z']),(.24,.07,window['depth']),dark)
for i in range(5):
    box('Window mullion',(5.34,1.46,window_start+i*pane_width),(.14,2.92,.065),dark)
for y in [.07,.95,2.88]:
    box('Window horizontal frame',(5.34,y,window['z']),(.14,.05,window['depth']),dark)
for i in range(4):
    box('Exterior window pane',(5.38,1.47,window_start+(i+.5)*pane_width),(.025,2.8,pane_width-.065),glass,merge=False)
box('Exterior ambient backdrop',(5.7,1.5,window['z']),(.02,3.1,window['depth']),exterior)
# Three real artworks occupy the solid return before the glazing.
box('Window return exhibition panel',(5.26,1.26,-.15),(.09,2.52,3),panel)
box('Window return ribbon',(5.204,1.45,-.15),(.012,.018,3),accent)
box('Partition exhibition ribbon',(3.725,1.45,-1.561),(3.35,.018,.012),accent)

# Entry lobby: no exhibition, but the door opening connects it to the main room.
r=layout['entranceLobby']
door=layout['entrance']['door']
near=door['z']+door['width']/2
far=door['z']-door['width']/2
box('Entry lobby west upper partition',(2.05,1.55,(north+far)/2),(.16,3.1,far-north),panel,collision=True)
box('Entry lobby west lower pier',(2.05,1.55,(near-1.65)/2),(.16,3.1,-1.65-near),panel,collision=True)
# Close the former opening in the south wall.
box('Entry lobby south partition',(3.725,1.55,-1.65),(3.35,3.1,.16),panel,collision=True)
box('Entrance lintel',(door['x'],2.675,door['z']),(.16,.85,door['width']),panel)
for z in [far,near]: box('Black entrance jamb',(door['x'],1.125,z),(.2,2.25,.055),dark)
box('Black entrance header',(door['x'],2.25,door['z']),(.2,.055,door['width']),dark)
# Open inward into the lobby, on the north hinge.
box('Open entrance door',(door['x']+door['width']/2,1.125,far),(door['width'],2.25,.045),plaster,merge=False,collision=True)
rod('Entrance door handle',(door['x']+.85,.96,far+.055),(door['x']+.85,1.12,far+.055),.012,dark)

for c in layout['columns']:
    x,z=c['x'],c['z']
    box('Square structural column',(x,1.57,z),(.48,3.14,.5),plaster,collision=True)
    box('Column foot',(x,.11,z),(.54,.22,.56),steel)
    rod('Column conduit',(x+.28,.15,z+.25),(x+.28,2.8,z+.25),.012,steel)
    box('Column socket',(x+.29,.3,z+.28),(.10,.13,.05),dark)
for z in [north+.3+i*.63 for i in range(20)]:
    box('Exposed transverse joist',(0,3.03,z),(10.8,.25,.12),steel)
for x in [-3.5,-1.25,2.6]:
    box('Longitudinal beam',(x,2.92,0),(.19,.34,room_depth),plaster)
for x in [-4.5,4.4]:
    rod('Service pipe',(x,2.77,north+.05),(x,2.77,south-.05),.045,steel)
    box('Lighting track',(x,2.85,0),(.045,.04,room_depth-.2),dark)
for z in [-5.5,3.4]:
    rod('Cross pipe',(-5.35,2.72,z),(5.35,2.72,z),.037,plaster)
for z in [-.7,3.7]:
    box('Air conditioner',(4.8,2.88,z),(.8,.34,1.4),plaster)
    box('Air conditioner grille',(4.36,2.85,z),(.03,.21,1.3),dark)
    for i in range(7): box('Vent fin',(4.337,2.76+i*.03,z),(.025,.011,1.3),steel)

# Continuous exhibition walls on the left and bottom, never across the glazing.
for i in range(11):
    span=(room_depth-.2)/11
    box('West exhibition panel',(-5.26,1.26,north+.1+(i+.5)*span),(.09,2.52,span-.005),panel)
for i in range(9):
    box('South exhibition panel',(-4.8+i*1.2,1.26,south-.14),(1.195,2.52,.09),panel)
for z in [-3,0,3]: box('Outlet',(-5.196,.28,z),(.035,.075,.12),white)
box('West exhibition ribbon',(-5.204,1.45,0),(.012,.018,room_depth-.1),accent)
box('South exhibition ribbon',(0,1.45,south-.196),(10.6,.018,.012),accent)

# Separate visitor signing desk and staffed service counter, in the marked areas.
def draped_table(name, footprint):
    x,z,w,d=footprint['x'],footprint['z'],footprint['width'],footprint['depth']
    box(name,(x,.4,z),(w,.8,d),cloth,merge=False,collision=True)
    box(name+' top',(x,.82,z),(w+.05,.04,d+.04),cloth)
    # One continuous drape with soft folds and a slightly uneven hem.
    vertices=[]; faces=[]; steps=64
    for row,y in enumerate([.035,.16,.55,.82]):
        for i in range(steps+1):
            dx=-w/2+w*i/steps
            wave=math.sin(dx*23)+.35*math.sin(dx*39)
            vertices.append(xyz((x+dx,y+(.008*math.cos(dx*17) if row==0 else 0),z+d/2+.05+wave*(.009+.014*(1-y/.82)))))
    for row in range(3):
        for i in range(steps):
            a=row*(steps+1)+i;faces.append((a,a+1,a+steps+2,a+steps+1))
    mesh=bpy.data.meshes.new(name+' cloth');mesh.from_pydata(vertices,[],faces);mesh.update()
    for polygon in mesh.polygons: polygon.use_smooth=True
    obj=bpy.data.objects.new(name+' flowing linen',mesh);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(cloth);static.append(obj)

def chair(x,z,facing=1):
    box('Folding chair seat',(x,.43,z),(.42,.055,.4),dark)
    box('Folding chair back',(x,.75,z-facing*.18),(.42,.24,.045),dark)
    colliders.append({'name':'Folding chair','x':x,'z':z,'width':.46,'depth':.48})
    for dx in [-.17,.17]:
        rod('Chair leg',(x+dx,.04,z-.2),(x+dx,.72,z+.2),.017,dark)
        rod('Chair leg',(x+dx,.04,z+.2),(x+dx,.43,z-.2),.017,dark)

draped_table('Staff service counter',layout['serviceDesk'])
for x in [-.55,.85]: chair(x,-5.78)
def desk_print(name,pos,size,filename):
    material=mat(name,(1,1,1))
    image=bpy.data.images.load(str(ROOT/'blender/textures'/filename)); image.pack()
    node=material.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
    material.node_tree.links.new(node.outputs['Color'],next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'])
    # A front-facing plane uses the same top-left image orientation as artwork canvases.
    w,h=size; x,y,z=pos
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([xyz((x-w/2,y-h/2,z)),xyz((x+w/2,y-h/2,z)),xyz((x+w/2,y+h/2,z)),xyz((x-w/2,y+h/2,z))],[],[(0,1,2,3)])
    mesh.update();uv=mesh.uv_layers.new()
    for loop,co in zip(mesh.polygons[0].loop_indices,[(0,0),(1,0),(1,1),(0,1)]): uv.data[loop].uv=co
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material);obj['preserveImage']=True
# Two larger framed displays, a small plaque and the glass PC at the right.
for x,w,h,filename in [(-1.02,.66,.36,'desk-landscape.jpg'),(-.35,.43,.48,'desk-portrait.jpg')]:
    box('Service display frame',(x,.85+h/2,-4.96),(w,h,.045),white)
    desk_print('Service framed print '+filename,(x,.85+h/2,-4.931),(w-.045,h-.045),filename)
    rod('Display easel',(x,.87,-4.98),(x,1.02,-5.13),.015,dark)
box('Small display plaque',(.07,.90,-4.68),(.16,.12,.025),dark)
box('Service papers',(-.95,.852,-4.55),(.34,.012,.21),white)
case=mat('Computer charcoal',(.028,.026,.038))
case_glass=mat('Computer glass',(.075,.048,.095))
next(n for n in case_glass.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Alpha'].default_value=.48
case_glass.surface_render_method='DITHERED'
pink=mat('Computer magenta',(.85,.05,.47))
cyan=mat('Computer cyan',(.05,.65,.9))
cx,cz=1.05,-4.84
box('Glass computer lower plinth',(cx,.885,cz),(.72,.09,.62),case)
box('Glass computer lid',(cx,1.525,cz),(.72,.07,.62),case)
box('Glass computer rear',(cx,1.20,cz-.29),(.69,.56,.035),case)
box('Computer front glass',(cx,1.20,cz+.293),(.65,.55,.012),case_glass)
box('Computer side glass',(cx-.342,1.20,cz),(.012,.55,.55),case_glass)
for dx in [-.345,.345]:
    for dz in [-.3,.3]: box('Computer frame post',(cx+dx,1.20,cz+dz),(.032,.64,.032),case)
def fan(x,y,z,radius,material):
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,location=xyz((x,y,z)),major_radius=radius,minor_radius=.009,rotation=(math.pi/2,0,0))
    o=bpy.context.object; o.name='Computer illuminated fan';o.data.materials.append(material);static.append(o)
    rod('Computer fan hub',(x,y,z-.012),(x,y,z+.012),.024,case)
for y in [1.025,1.20,1.375]: fan(cx+.20,y,cz+.305,.064,pink)
fan(cx-.12,1.38,cz+.305,.088,cyan)
box('Computer small screen',(cx-.10,1.04,cz+.309),(.19,.09,.009),cyan)
rod('Computer diagonal brace',(cx-.27,1.03,cz+.313),(cx+.05,1.33,cz+.313),.009,pink)
box('Frame on computer',(cx,1.70,cz),(.38,.29,.034),white)
desk_print('Print on computer',(cx,1.70,cz+.022),(.34,.25),'desk-top-print.jpg')

draped_table('Guestbook table',layout['guestbook'])
box('Guestbook cover',(-3.8,.85,-5.57),(.65,.025,.4),dark)
for x in [-3.955,-3.645]:
    box('Open guestbook page',(x,.869,-5.57),(.305,.013,.375),white)
    for i in range(5): box('Guestbook writing line',(x,.877,-5.70+i*.057),(.24,.002,.003),seam)
rod('Guestbook spine',(-3.8,.88,-5.75),(-3.8,.88,-5.39),.008,cloth)
rod('Signing pen',(-3.26,.868,-5.66),(-3.2,.868,-5.46),.012,dark)
chair(-4.65,-4.75,-1)

arts=[]
placements=json.loads((ROOT/'blender/artwork-layout.json').read_text())
assets=json.loads((ROOT/'blender/artwork-assets.json').read_text())
# Retain source wall ordering and artwork sizes while extending the room.
for spec in placements['artworks']:
    if spec['zone']=='south':
        spec['position'][2]+=south-5.1
        if 'viewPosition' in spec: spec['viewPosition'][2]+=south-5.1
    elif spec['zone']=='west':
        spec['position'][2]+=(spec['position'][2]+4.4)/8.8*(south-5.1)
    elif spec['key'] in ['guestbook-flag','service-backdrop']:
        spec['position'][2]+=north+5.1
        spec['viewPosition'][2]+=north+5.1

def art(spec):
    ident=spec['id']
    pos,w,h,rot=spec['position'],spec['width'],spec['height'],spec['rotation']
    column_mounted=spec.get('columnMounted',False)
    details_enabled=spec['detailsEnabled']
    # Frameless wrapped canvas: front and four folded sides belong to one mesh.
    a=math.radians(rot)
    depth=.035
    def local(dx,dy,dz): return (pos[0]+dx*math.cos(a)+dz*math.sin(a),pos[1]+dy,pos[2]-dx*math.sin(a)+dz*math.cos(a))
    # Normalized photo corners are bottom-left, bottom-right, top-right, top-left.
    # Blender UV uses a bottom-left origin; source metadata uses top-left.
    corners=[(u,1-v) for u,v in spec['uvCorners']] if 'uvCorners' in spec else [(0,0),(1,0),(1,1),(0,1)]
    def image_uv(u,v):
        bl,br,tr,tl=corners
        return tuple((1-v)*((1-u)*bl[k]+u*br[k])+v*((1-u)*tl[k]+u*tr[k]) for k in range(2))
    front=[(-w/2,-h/2,0),(w/2,-h/2,0),(w/2,h/2,0),(-w/2,h/2,0)]
    back=[(x,y,-depth) for x,y,_ in front]
    vertices=front+back
    faces=[(0,1,2,3),(4,0,3,7),(1,5,6,2),(3,2,6,7),(4,5,1,0),(5,4,7,6)]
    face_uvs=[[(0,0),(1,0),(1,1),(0,1)],[(.04,0),(0,0),(0,1),(.04,1)],[(1,0),(.96,0),(.96,1),(1,1)],[(0,1),(1,1),(1,.96),(0,.96)],[(0,.04),(1,.04),(1,0),(0,0)],[(1,0),(0,0),(0,1),(1,1)]]
    mesh=bpy.data.meshes.new('WrappedCanvas_'+ident)
    mesh.from_pydata([xyz(local(*v)) for v in vertices],[],faces); mesh.update()
    uv=mesh.uv_layers.new()
    colors=mesh.color_attributes.new(name='Canvas fold shading',type='FLOAT_COLOR',domain='CORNER')
    # Adding a color layer reallocates CustomData; reacquire the UV layer.
    uv=mesh.uv_layers.active
    for polygon,coords in zip(mesh.polygons,face_uvs):
        shade=1 if polygon.index==0 or spec['imageKind']=='flat-vector' else .72
        for loop,co in zip(polygon.loop_indices,coords):
            uv.data[loop].uv=image_uv(*co)
            colors.data[loop].color=(shade,shade,shade,1)
    obj=bpy.data.objects.new('Artwork_'+ident,mesh); bpy.context.collection.objects.link(obj)
    # Pack authentic image materials into both the editable Blender file and GLB.
    material=mat('Artwork image '+spec['key'],(1,1,1))
    image=bpy.data.images.load(str(ROOT/'blender'/assets[spec['key']]['modelImage']),check_existing=True)
    image.pack()
    texture=material.node_tree.nodes.new('ShaderNodeTexImage'); texture.image=image
    material.node_tree.links.new(texture.outputs['Color'],next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'])
    obj.data.materials.append(material)
    obj['artworkId']=ident; obj['detailsEnabled']=details_enabled; obj['canvasDepth']=depth
    obj['sourceKey']=spec['key']; obj['imageKind']=spec['imageKind']
    if details_enabled:
        label_pos=local(w/2+.045,-h/2+.02,0) if spec.get('labelSide') else local(0,-h/2-.065,0)
        label=box('Label_'+ident,label_pos,(.12 if spec.get('labelSide') else .16,.035,.008),white)
        label.rotation_euler.z=a
    if not column_mounted and details_enabled:
        for dx in [-w*.32,w*.32]: rod('Picture wire',local(dx,h/2+.02,-.025),local(dx,2.53-pos[1],-.025),.003,steel)
    entry={k:v for k,v in spec.items() if k not in ['columnMounted','labelSide','uvCorners']}
    entry['depth']=depth
    entry['texture']=assets[spec['key']]['sceneImage']
    entry['thumbnail']=assets[spec['key']]['thumbnailImage']
    if details_enabled: entry['detailImages']=assets[spec['key']]['detailImages']
    entry['medium']='現場影像對位' if spec['imageKind']=='reference-photo' else '數位插畫・無框畫'
    entry['description']='依現場影像對位的展示背板。' if spec['imageKind']=='reference-photo' else f"{spec['artist']}的作品，依原始圖檔完整比例呈現。"
    if spec['imageKind']=='flat-vector':
        entry['medium']='平面向量旗幟'
        entry['description']='依現場可見圖案簡化的平面 SVG 旗幟。'
    if spec['imageKind']=='original-artwork':
        entry['sourceSize']=assets[spec['key']]['sourceSize']
    arts.append(entry)
    if details_enabled and not column_mounted:
        start=local(0,2.69-pos[1],1.0); end=local(0,2.52-pos[1],.84)
        rod('Spotlight housing',start,end,.055,steel)
        rod('Spotlight lens',end,local(0,2.51-pos[1],.83),.047,lightmat)

for spec in placements['artworks']: art(spec)

# Height ruler on the same column face: actual centimetres from the floor.
ruler_yellow=mat('Ruler yellow',(.95,.64,.08))
ruler_ink=mat('Ruler ink',(.045,.032,.016))
ruler_spots=mat('Ruler spots',(.63,.27,.07))
ruler=layout['heightRuler']; rx,rz=ruler['x'],ruler['z']
box('Height ruler strip',(rx,.9,rz),(.008,1.8,.075),ruler_yellow)
for cm in range(0,181):
    length=.028 if cm%10==0 else .019 if cm%5==0 else .011
    box('Ruler tick '+str(cm),(rx+.006,cm/100,rz+.036-length/2),(.004,.0015,length),ruler_ink)
    if cm%10==0:
        bpy.ops.object.text_add(location=xyz((rx+.01,cm/100-.006,rz-.011)))
        o=bpy.context.object; o.name='Ruler number '+str(cm)
        o.data.body=str(cm); o.data.size=.017; o.data.align_x='CENTER'
        o.rotation_euler=(math.pi/2,0,math.pi/2)
        o.data.materials.append(ruler_ink)
        bpy.ops.object.convert(target='MESH'); static.append(bpy.context.object)
# Simple giraffe silhouette above 180 cm, with ears, horns, eye and patterned neck.
box('Giraffe head',(rx,1.87,rz),(.008,.14,.11),ruler_yellow)
for z in [rz-.032,rz+.032]:
    rod('Giraffe horn',(rx,1.93,z),(rx,1.98,z),.007,ruler_spots)
    box('Giraffe ear',(rx,1.915,z*1+(z-rz)*.75),(.009,.035,.027),ruler_yellow)
box('Giraffe eye',(rx+.008,1.89,rz+.019),(.004,.016,.013),ruler_ink)
box('Giraffe cheek',(rx+.008,1.851,rz+.022),(.004,.018,.019),ruler_spots)
for y in [.14,.34,.54,.74,.94,1.14,1.34,1.54,1.74]:
    box('Giraffe neck spot',(rx+.005,y,rz-.029),(.003,.035,.018),ruler_spots)

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
cam.rotation_euler=(Vector(xyz((layout['entrance']['position'][0]-math.sin(layout['entrance']['yaw']),1.65,layout['entrance']['position'][2]-math.cos(layout['entrance']['yaw']))))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.lens=22; scene.camera=cam
for p in [(-2,2.6,-3),(2,2.6,2)]:
    bpy.ops.object.light_add(type='AREA',location=xyz(p))
    bpy.context.object.data.energy=350
    bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=5
scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.render.resolution_x=1440; scene.render.resolution_y=900; scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender'/'gallery.blend'))
# Web export embeds only small previews. Full materials remain in the saved .blend.
for spec in placements['artworks']:
    material=bpy.data.materials['Artwork image '+spec['key']]
    for node in material.node_tree.nodes:
        if node.type=='TEX_IMAGE':
            node.image=bpy.data.images.load(str(ROOT/'blender'/assets[spec['key']]['previewImage']),check_existing=True)
for node in list(concrete.node_tree.nodes):
    if node.type=='TEX_IMAGE': concrete.node_tree.nodes.remove(node)
bpy.ops.export_scene.gltf(filepath=str(OUT/'models'/'gallery.glb'),export_format='GLB',export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
(OUT/'gallery.json').write_text(json.dumps({'artworks':arts,'colliders':colliders,'bounds':{'minX':-4.95,'maxX':4.95,'minZ':north+.45,'maxZ':south-.45},'layout':layout,'unplacedArtworks':placements['unplaced']},ensure_ascii=False,indent=2))
triangles=sum(len(o.data.polygons) for o in bpy.data.objects if o.type=='MESH')
print(f'Gallery exported: {len(arts)} artworks, {triangles} polygons, {(OUT/"models"/"gallery.glb").stat().st_size} bytes')

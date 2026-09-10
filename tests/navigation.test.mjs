import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { canOccupy, movePosition, segmentClear, findWalkPath } from '../src/navigation.mjs'
import { stations } from '../src/stations.ts'
import { mapPoint, drawFloorPlan } from '../src/floor-plan.ts'
import { canOpenDetails, getDetailArtworks } from '../src/artwork.ts'
const gallery=JSON.parse(readFileSync(new URL('../public/gallery.json',import.meta.url),'utf8'))
const {bounds,colliders}=gallery

test('room boundaries stop the camera at every wall',()=>{
  for(const [x,z] of [[-5.4,0],[5.4,0],[0,-5.1],[0,5.1]])assert.equal(canOccupy(x,z,bounds,colliders),false)
  assert.equal(canOccupy(1.25,4.1,bounds,colliders),true)
})
test('camera cannot tunnel through a pillar on a delayed frame',()=>{
  const p=movePosition({x:-2.5,z:-2.94},3,0,bounds,colliders)
  assert.ok(p.x < -1.7)
  assert.ok(canOccupy(p.x,p.z,bounds,colliders))
})
test('collision slides along a wall rather than freezing movement',()=>{
  const p=movePosition({x:4.5,z:0},1,-1,bounds,colliders)
  assert.ok(p.x<=bounds.maxX)
  assert.ok(p.z < -.9)
})
test('table footprint and column clearance prevent overlap',()=>{
  for(const c of colliders)assert.equal(canOccupy(c.x,c.z,bounds,colliders),false)
})
test('all artwork viewing destinations remain walkable',()=>{
  for(const a of gallery.artworks){
    const angle=a.rotation*Math.PI/180
    const x=a.viewPosition?.[0] ?? a.position[0]+Math.sin(angle)*1.65
    const z=a.viewPosition?.[2] ?? a.position[2]+Math.cos(angle)*1.65
    assert.ok(canOccupy(x,z,bounds,colliders),`Artwork ${a.id} has an obstructed viewing point`)
  }
})
test('exported GLB has all artwork IDs and bounded asset size',()=>{
  const glb=readFileSync(new URL('../public/models/gallery.glb',import.meta.url))
  assert.equal(glb.readUInt32LE(0),0x46546c67)
  assert.equal(glb.readUInt32LE(4),2)
  assert.ok(glb.length<2*1024*1024)
  const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString())
  const ids=json.nodes.filter(n=>n.extras?.artworkId).map(n=>n.extras.artworkId)
  assert.equal(new Set(ids).size,gallery.artworks.length)
  for(const a of gallery.artworks){assert.ok(ids.includes(a.id));assert.ok(existsSync(new URL('../public/'+a.image,import.meta.url)))}
})


test('floor route detours around a pillar with clearance along every segment',()=>{
  const start={x:-3,z:-2.94},target={x:.8,z:-2.94}
  assert.equal(segmentClear(start,target,bounds,colliders),false)
  const route=findWalkPath(start,target,bounds,colliders)
  assert.ok(route && route.length>1)
  assert.deepEqual(route.at(-1),target)
  let previous=start
  for(const next of route){
    assert.ok(segmentClear(previous,next,bounds,colliders))
    for(let i=0;i<=200;i++)assert.ok(canOccupy(previous.x+(next.x-previous.x)*i/200,previous.z+(next.z-previous.z)*i/200,bounds,colliders))
    previous=next
  }
})
test('open floor uses a direct path; invalid destinations are rejected',()=>{
  assert.deepEqual(findWalkPath({x:1,z:0},{x:2,z:1},bounds,colliders),[{x:2,z:1}])
  assert.equal(findWalkPath({x:1,z:0},{x:5,z:0},bounds,colliders),null)
  assert.equal(findWalkPath({x:1,z:0},{x:gallery.layout.serviceDesk.x,z:gallery.layout.serviceDesk.z},bounds,colliders),null)
})
test('an unreachable destination does not generate a route through a blocking wall',()=>{
  const wall=[{x:0,z:0,width:1,depth:20}]
  assert.equal(findWalkPath({x:-2,z:0},{x:2,z:0},bounds,wall),null)
})
test('swept clearance rejects corner clipping even when the center line misses a pillar',()=>{
  const pillar=[{x:0,z:0,width:1,depth:1}]
  assert.equal(segmentClear({x:-1,z:.7},{x:1,z:.7},bounds,pillar),false)
  assert.equal(segmentClear({x:-1,z:.8},{x:1,z:.8},bounds,pillar),true)
})
test('every guide station and artwork can be reached from the entrance',()=>{
  const [x,,z]=gallery.layout.entrance.position
  const start={x,z}
  assert.ok(canOccupy(x,z,bounds,colliders))
  for(const [zone,s] of Object.entries(stations)){
    const [x,,z]=s.position
    assert.ok(findWalkPath(start,{x,z},bounds,colliders),zone)
  }
  for(const a of gallery.artworks){
    const angle=a.rotation*Math.PI/180
    const x=a.viewPosition?.[0] ?? a.position[0]+Math.sin(angle)*1.65
    const z=a.viewPosition?.[2] ?? a.position[2]+Math.cos(angle)*1.65
    assert.ok(findWalkPath(start,{x,z},bounds,colliders),a.id)
  }
})
test('entry lobby connects to the gallery only through the doorway',()=>{
  const d=gallery.layout.entrance.door
  assert.equal(d.wall,'west')
  const start={x:d.x+.6,z:d.z},end={x:d.x-.6,z:d.z}
  assert.ok(segmentClear(start,end,bounds,colliders))
  assert.ok(findWalkPath(start,{x:0,z:0},bounds,colliders))
  assert.equal(segmentClear({x:4,z:-2.3},{x:4,z:-1},bounds,colliders),false)
  assert.equal(segmentClear({x:2.7,z:-3.2},{x:1.5,z:-3.2},bounds,colliders),false)
})
test('entry view places the service desk to the right and the column ahead',()=>{
  const {entrance:e,serviceDesk:s,columns}=gallery.layout
  const [x,,z]=e.position
  assert.ok((s.x-x)*Math.cos(e.yaw)-(s.z-z)*Math.sin(e.yaw)>0)
  const c=columns[0]
  assert.ok(-(c.x-x)*Math.sin(e.yaw)-(c.z-z)*Math.cos(e.yaw)>0)
  assert.ok(x<e.door.x)
  assert.ok(Math.abs(z-e.door.z)<e.door.width/2)
})
test('staff counter and signing desk are separate and match blocked furniture',()=>{
  const {serviceDesk:s,guestbook:g}=gallery.layout
  assert.ok(g.x+g.width/2<s.x-s.width/2)
  for(const desk of [s,g])assert.ok(colliders.some(c=>c.x===desk.x&&c.z===desk.z&&c.width===desk.width&&c.depth===desk.depth))
})
test('no artwork occupies the entry lobby or the exterior window wall',()=>{
  const r=gallery.layout.entranceLobby,w=gallery.layout.window
  for(const a of gallery.artworks){
    const [x,,z]=a.position
    assert.ok(!(x>r.x-r.width/2&&z<r.z+r.depth/2),a.id)
    assert.ok(!(Math.abs(x-w.x)<.4&&z>w.z-w.depth/2&&z<w.z+w.depth/2),a.id)
  }
})
test('window panes survive GLB export with transparent material',()=>{
  const glb=readFileSync(new URL('../public/models/gallery.glb',import.meta.url))
  const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString())
  const glass=json.materials.find(m=>m.name==='Window glass')
  assert.equal(glass.alphaMode,'BLEND')
  assert.ok(glass.pbrMetallicRoughness.baseColorFactor[3]<1)
  assert.equal(json.nodes.filter(n=>n.name.startsWith('Exterior window pane')).length,4)
})
test('floor plan uses the model proportions and keeps annotated areas oriented correctly',()=>{
  const l=gallery.layout
  assert.deepEqual(mapPoint(l.outer.minX,l.outer.minZ,l),{x:8,y:8})
  assert.ok(Math.abs(mapPoint(l.outer.maxX,0,l).x-112)<1e-9)
  assert.ok(mapPoint(l.guestbook.x,l.guestbook.z,l).x<mapPoint(l.serviceDesk.x,l.serviceDesk.z,l).x)
  const room=mapPoint(l.entranceLobby.x,l.entranceLobby.z,l)
  assert.ok(room.x>60&&room.y<55)
})

test('only the two large desk backdrops disable details in JSON and GLB',()=>{
  const displays=gallery.artworks.filter(a=>!canOpenDetails(a))
  assert.equal(displays.length,2)
  assert.deepEqual(displays.map(a=>a.zone).sort(),['guestbook','reception'])
  assert.ok(displays.every(a=>a.width>2&&a.height>1))
  assert.ok(gallery.artworks.every(a=>typeof a.detailsEnabled==='boolean'))
  const details=getDetailArtworks(gallery.artworks)
  assert.equal(details.length,19)
  assert.ok(details.every(a=>!displays.includes(a)))
  const glb=readFileSync(new URL('../public/models/gallery.glb',import.meta.url))
  const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString())
  for(const a of gallery.artworks){
    assert.equal(json.nodes.find(n=>n.extras?.artworkId===a.id).extras.detailsEnabled,a.detailsEnabled)
  }
})
test('column canvas is wall-mounted at the photo ruler heights',()=>{
  const a=gallery.artworks.find(a=>a.id==='20')
  assert.ok(Math.abs(a.position[1]+a.height/2-1.8)<1e-9)
  assert.ok(Math.abs(a.position[1]-a.height/2-1.1)<1e-9)
  assert.equal(a.imageKind,'reference-photo')
  assert.ok(existsSync(new URL('../public/'+a.image,import.meta.url)))
  assert.equal(a.rotation,90)
  assert.ok(canOpenDetails(a))
  assert.equal(gallery.layout.heightRuler.maxCm,180)
})
test('all canvases have thickness, wrapped sides and no border frames',()=>{
  const glb=readFileSync(new URL('../public/models/gallery.glb',import.meta.url))
  const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString())
  assert.ok(!json.nodes.some(n=>n.name.startsWith('Frame_')))
  for(const a of gallery.artworks){
    assert.ok(a.depth>0&&a.depth<.1)
    const node=json.nodes.find(n=>n.extras?.artworkId===a.id)
    assert.equal(node.extras.canvasDepth,a.depth)
    const primitive=json.meshes[node.mesh].primitives[0]
    assert.equal(json.accessors[primitive.indices].count,36)
    assert.ok(primitive.attributes.COLOR_0!==undefined)
    const bounds=json.accessors[primitive.attributes.POSITION]
    const sizes=bounds.max.map((v,i)=>v-bounds.min[i]).sort((a,b)=>a-b)
    const expected=[a.width,a.height,a.depth].sort((a,b)=>a-b)
    sizes.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-5,a.id))
  }
})
test('floor plan draws the doorway swing and entrance label',()=>{
  const group={innerHTML:''}
  drawFloorPlan(group,gallery.layout)
  assert.ok(group.innerHTML.includes('入口'))
  assert.ok(!group.innerHTML.includes('未使用'))
  assert.match(group.innerHTML,/ A[\d.]+ [\d.]+ 0 0 1 /)
})

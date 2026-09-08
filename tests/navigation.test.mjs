import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { canOccupy, movePosition, segmentClear, findWalkPath } from '../src/navigation.mjs'
import { stations } from '../src/stations.ts'
import { mapPoint } from '../src/floor-plan.ts'
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
test('unused room rejects destinations and routes across its entire footprint',()=>{
  const r=gallery.layout.unusedRoom
  for(let x=r.x-r.width/2;x<=r.x+r.width/2;x+=.2){
    for(let z=r.z-r.depth/2;z<=r.z+r.depth/2;z+=.2){
      assert.equal(canOccupy(x,z,bounds,colliders),false)
    }
  }
  assert.equal(findWalkPath({x:0,z:0},{x:r.x,z:r.z},bounds,colliders),null)
  assert.equal(segmentClear({x:1.4,z:-4.2},{x:4.5,z:0},bounds,colliders),false)
})
test('staff counter and signing desk are separate and match blocked furniture',()=>{
  const {serviceDesk:s,guestbook:g}=gallery.layout
  assert.ok(g.x+g.width/2<s.x-s.width/2)
  for(const desk of [s,g])assert.ok(colliders.some(c=>c.x===desk.x&&c.z===desk.z&&c.width===desk.width&&c.depth===desk.depth))
})
test('no artwork occupies the unused room or the exterior window wall',()=>{
  const r=gallery.layout.unusedRoom,w=gallery.layout.window
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
  const room=mapPoint(l.unusedRoom.x,l.unusedRoom.z,l)
  assert.ok(room.x>60&&room.y<55)
})

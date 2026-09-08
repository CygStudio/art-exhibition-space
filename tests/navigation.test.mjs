import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { canOccupy, movePosition } from '../src/navigation.mjs'
const gallery=JSON.parse(readFileSync(new URL('../public/gallery.json',import.meta.url),'utf8'))
const {bounds,colliders}=gallery

test('room boundaries stop the camera at every wall',()=>{
  for(const [x,z] of [[-5,0],[5,0],[0,-6],[0,6]])assert.equal(canOccupy(x,z,bounds,colliders),false)
  assert.equal(canOccupy(1.25,4.1,bounds,colliders),true)
})
test('camera cannot tunnel through a pillar on a delayed frame',()=>{
  const p=movePosition({x:-2.5,z:-1.45},3,0,bounds,colliders)
  assert.ok(p.x < -1.8)
  assert.ok(canOccupy(p.x,p.z,bounds,colliders))
})
test('collision slides along a wall rather than freezing movement',()=>{
  const p=movePosition({x:4.5,z:0},1,-1,bounds,colliders)
  assert.ok(p.x<=4.55)
  assert.ok(p.z < -.9)
})
test('table footprint and column clearance prevent overlap',()=>{
  for(const c of colliders)assert.equal(canOccupy(c.x,c.z,bounds,colliders),false)
})
test('all artwork viewing destinations remain walkable',()=>{
  for(const a of gallery.artworks){
    const angle=a.rotation*Math.PI/180
    const x=a.position[0]+Math.sin(angle)*1.65
    const z=a.zone==='reception'?3.3:a.position[2]+Math.cos(angle)*1.65
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

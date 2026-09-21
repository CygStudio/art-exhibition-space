import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createArtworkTextures } from '../src/artwork-textures.ts'

function setup() {
  const camera = new THREE.PerspectiveCamera(72, 1, .05, 45)
  const meshes = new Map()
  const entries = Array.from({ length: 6 }, (_, i) => {
    const position = [0, 0, -(i + 2)]
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.Texture() }))
    mesh.position.set(...position); mesh.updateMatrixWorld()
    meshes.set(String(i), mesh)
    return { id: String(i), position, rotation: 0, texture: `${i}.webp` }
  })
  return { camera, meshes, entries }
}
const settle = () => new Promise(resolve => setImmediate(resolve))

test('upgrades prioritize nearby visible art and never exceed three active downloads', async () => {
  const { camera, meshes, entries } = setup()
  const requests = []
  const stream = createArtworkTextures(entries, meshes, '/', 4, url => new Promise(resolve => requests.push({ url, resolve })))
  stream.update(camera, 0)
  assert.deepEqual(requests.map(r => r.url), ['/0.webp', '/1.webp', '/2.webp'])
  stream.update(camera, 300)
  assert.equal(requests.length, 3)
  const preview = meshes.get('0').material.map
  let disposed = false
  preview.addEventListener('dispose', () => { disposed = true })
  const full = new THREE.Texture()
  requests[0].resolve(full); await settle()
  assert.equal(meshes.get('0').material.map, full)
  assert.equal(full.flipY, false)
  assert.equal(full.colorSpace, THREE.SRGBColorSpace)
  assert.ok(disposed)
  stream.update(camera, 600)
  assert.equal(requests.length, 4)
  stream.stop()
})

test('failed upgrades keep previews, retry with backoff and do not request art behind the camera', async () => {
  const { camera, meshes, entries } = setup()
  let requests = 0
  const stream = createArtworkTextures(entries.slice(0, 1), meshes, '/', 4, async () => { requests++; throw new Error('offline') })
  const preview = meshes.get('0').material.map
  camera.rotation.y = Math.PI
  stream.update(camera, 0)
  assert.equal(requests, 0)
  camera.rotation.y = 0
  stream.update(camera, performance.now() + 300); await settle()
  assert.equal(requests, 1)
  assert.equal(meshes.get('0').material.map, preview)
  stream.update(camera, performance.now() + 600)
  assert.equal(requests, 1)
  stream.update(camera, performance.now() + 5000); await settle()
  assert.equal(requests, 2)
  stream.stop()
})

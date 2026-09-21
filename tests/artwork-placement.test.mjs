import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const read = path => readFileSync(new URL('../' + path, import.meta.url))
const gallery = JSON.parse(read('public/gallery.json'))
const assets = JSON.parse(read('blender/artwork-assets.json'))
const glb = read('public/models/gallery.glb')
const jsonLength = glb.readUInt32LE(12)
const model = JSON.parse(glb.subarray(20, 20 + jsonLength))
const binaryStart = 28 + jsonLength
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

test('all 27 identified originals retain their image proportions and source attribution', () => {
  const originals = gallery.artworks.filter(a => a.imageKind === 'original-artwork')
  assert.equal(originals.length, 27)
  assert.equal(new Set(originals.map(a => a.key)).size, 27)
  for (const art of originals) {
    const asset = assets[art.key]
    assert.equal(art.sourceFile, asset.sourceFile)
    assert.ok(art.artist && art.evidence)
    assert.ok(Math.abs(art.width / art.height - asset.sourceSize[0] / asset.sourceSize[1]) < 1e-5, art.key)
    assert.match(art.image, /\.webp$/)
    assert.match(asset.sha256, /^[a-f0-9]{64}$/)
  }
  assert.equal(assets.hwaguwu.sourceMode, 'CMYK')
  assert.equal(assets.hwaguwu.convertedICC, true)
})

test('every GLB canvas embeds an authentic preview and has an independent full texture', () => {
  for (const art of gallery.artworks) {
    const node = model.nodes.find(n => n.extras?.artworkId === art.id)
    assert.equal(node.extras.sourceKey, art.key)
    const primitive = model.meshes[node.mesh].primitives[0]
    const material = model.materials[primitive.material]
    const texture = model.textures[material.pbrMetallicRoughness.baseColorTexture.index]
    const image = model.images[texture.source]
    assert.equal(image.mimeType, 'image/jpeg')
    const view = model.bufferViews[image.bufferView]
    const embedded = glb.subarray(binaryStart + view.byteOffset, binaryStart + view.byteOffset + view.byteLength)
    assert.equal(digest(embedded), digest(read('blender/' + assets[art.key].previewImage)), art.key)
    assert.ok(read('public/' + art.texture).length > 0, art.key)
    assert.ok(read('public/' + art.thumbnail).length > 0, art.key)
    assert.ok(primitive.attributes.COLOR_0 !== undefined, art.key)
  }
})

test('the initial scene stays within the preview budget and the flag remains flat SVG', () => {
  assert.ok(glb.length < 1_300_000, `${glb.length} bytes`)
  const embeddedBytes = model.images.reduce((sum, image) => sum + model.bufferViews[image.bufferView].byteLength, 0)
  assert.ok(embeddedBytes < 130_000, `${embeddedBytes} embedded image bytes`)
  assert.equal(model.images.length, gallery.artworks.length + 3)
  const flag = gallery.artworks.find(a => a.key === 'guestbook-flag')
  assert.equal(flag.imageKind, 'flat-vector')
  assert.match(flag.texture, /\.svg$/)
  assert.doesNotMatch(read('public/' + flag.texture).toString(), /<image|<filter|<.*Gradient/)
})

test('wall sequences follow the photographed viewing direction', () => {
  const sequence = (zone, axis, direction) => gallery.artworks
    .filter(a => a.zone === zone).sort((a, b) => direction * (a.position[axis] - b.position[axis])).map(a => a.key)
  assert.deepEqual(sequence('south', 0, -1), ['egg-01', 'didi', 'css-portrait', 'lllokkk-portrait', 'hwaguwu', 'yukimura-portrait', 'yukimura-landscape', 'css-landscape', 'egg-02', 'chill'])
  assert.deepEqual(sequence('west', 2, -1), ['bbibinbing', 'bird-01', 'zm', 'qb', 'wz', 'toyasan-portrait', 'bird-02', 'medo', 'toyasan-square'])
  const returns = gallery.artworks.filter(a => a.rotation === -90).sort((a, b) => a.position[2] - b.position[2])
  assert.deepEqual(returns.map(a => a.key), ['jen', 'kakult-landscape', 'enruzero'])
  const upper = gallery.artworks.find(a => a.key === 'lllokkk-landscape')
  const lower = gallery.artworks.find(a => a.key === 'chejan')
  assert.ok(upper.position[1] - upper.height / 2 > lower.position[1] + lower.height / 2)
})

test('canvases on the same wall have clearance and fit inside the available wall', () => {
  for (const a of gallery.artworks) {
    const along = Math.abs(a.rotation) === 90 ? 2 : 0
    const normal = along === 2 ? 0 : 2
    assert.ok(a.position[1] - a.height / 2 > .4, a.key)
    assert.ok(a.position[1] + a.height / 2 < 2.9, a.key)
    const low = along === 0 ? gallery.layout.outer.minX : gallery.layout.outer.minZ
    const high = along === 0 ? gallery.layout.outer.maxX : gallery.layout.outer.maxZ
    assert.ok(a.position[along] - a.width / 2 > low + .1 && a.position[along] + a.width / 2 < high - .1, a.key)
    if (a.rotation === -90) {
      assert.ok(a.position[2] - a.width / 2 > -1.65, a.key)
      assert.ok(a.position[2] + a.width / 2 < gallery.layout.window.z - gallery.layout.window.depth / 2, a.key)
    }
    for (const b of gallery.artworks) {
      if (a.id >= b.id || a.rotation !== b.rotation || Math.abs(a.position[normal] - b.position[normal]) > .05) continue
      const horizontal = Math.abs(a.position[along] - b.position[along]) - (a.width + b.width) / 2
      const vertical = Math.abs(a.position[1] - b.position[1]) - (a.height + b.height) / 2
      assert.ok(horizontal > .035 || vertical > .035, `${a.key} overlaps ${b.key}`)
    }
  }
})

test('unlocated originals stay recorded without inventing an exhibition position', () => {
  assert.deepEqual(gallery.unplacedArtworks.map(a => a.key), ['for-adam-01', 'for-adam-02'])
  for (const art of gallery.unplacedArtworks) assert.ok(!gallery.artworks.some(a => a.key === art.key))
  assert.deepEqual(gallery.artworks.filter(a => !a.detailsEnabled).map(a => a.key), ['guestbook-flag', 'service-backdrop'])
})

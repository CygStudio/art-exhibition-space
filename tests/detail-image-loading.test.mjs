import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createDetailImageCache, createDetailImageSelection, selectDetailImage } from '../src/detail-image-loader.ts'

const tick = () => new Promise(resolve => setImmediate(resolve))
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
function harness() {
  const requests = []
  const disposed = []
  const cache = createDetailImageCache((url, signal, priority) => new Promise((resolve, reject) => {
    requests.push({ url, signal, priority, resolve: () => resolve({ image: { url }, dispose: () => disposed.push(url) }), reject })
  }))
  const states = []
  const selection = createDetailImageSelection(cache, state => states.push({ ...state }), 0)
  return { requests, disposed, cache, selection, states }
}

test('selection resets synchronously and ignores late success/error from older artworks', async () => {
  const h = harness()
  const a = h.selection.select('a', 'a-small', 'a-full')
  assert.deepEqual(h.states.at(-1), { id: 'a', phase: 'loading', quality: 'empty' })
  const b = h.selection.select('b', 'b-small', 'b-full')
  assert.deepEqual(h.states.at(-1), { id: 'b', phase: 'loading', quality: 'empty' })
  assert.ok(h.requests[0].signal.aborted && h.requests[1].signal.aborted)
  h.requests[2].resolve(); await tick()
  assert.equal(h.states.at(-1).quality, 'preview')
  h.requests[3].resolve(); await b
  h.requests[1].resolve(); h.requests[0].reject(new Error('old failure')); await a; await tick()
  assert.deepEqual(h.states.at(-1), { id: 'b', phase: 'ready', quality: 'full', image: { url: 'b-full' }, source: 'b-full' })
  assert.deepEqual(h.disposed, ['a-full'])
  assert.ok(h.states.slice(1).every(state => state.id === 'b'))
  h.selection.cancel(); h.cache.clear()
})

test('a failed foreground load preserves the correct preview and retry starts fresh', async () => {
  const h = harness()
  const first = h.selection.select('a', 'a-small', 'a-full')
  h.requests[0].resolve(); await tick()
  h.requests[1].reject(new Error('HTTP 503')); await first
  assert.equal(h.states.at(-1).phase, 'error')
  assert.equal(h.states.at(-1).image.url, 'a-small')
  const second = h.selection.select('a', 'a-small', 'a-full')
  assert.equal(h.states.at(-1).phase, 'loading')
  assert.equal(h.requests.length, 3)
  h.requests[2].resolve(); await second
  assert.equal(h.states.at(-1).phase, 'ready')
  h.selection.cancel(); h.cache.clear()
})

test('closing and reopening invalidates callbacks and clears the previous error state', async () => {
  const h = harness()
  const a = h.selection.select('a', 'a-small', 'a-full')
  h.selection.cancel()
  const count = h.states.length
  h.requests[0].resolve(); h.requests[1].resolve(); await a; await tick()
  assert.equal(h.states.length, count)
  const b = h.selection.select('b', 'b-small', 'b-full')
  assert.equal(h.states.at(-1).id, 'b')
  assert.equal(h.states.at(-1).quality, 'empty')
  h.requests[3].resolve(); await b
  h.requests[2].resolve(); await tick()
  assert.equal(h.states.at(-1).quality, 'full')
  h.selection.cancel(); h.cache.clear()
})

test('adjacent preloads are serial, bounded, reused by selection and canceled when obsolete', async () => {
  const h = harness()
  const a = h.selection.select('a', 'a-small', 'a-full', ['b-full', 'c-full', 'ignored'])
  h.requests[1].resolve(); await a; await delay(10)
  assert.deepEqual(h.requests.map(r => r.url), ['a-small', 'a-full', 'b-full'])
  assert.equal(h.requests[2].priority, 'low')
  const b = h.selection.select('b', 'b-small', 'b-full')
  assert.equal(h.requests.filter(r => r.url === 'b-full').length, 1)
  h.requests[2].resolve(); await b; await delay(10)
  assert.ok(!h.requests.some(r => r.url === 'c-full' || r.url === 'ignored'))
  assert.equal(h.states.at(-1).source, 'b-full')
  h.selection.cancel(); h.cache.clear()
})

test('cache bounds stalled requests, permits retry and releases evicted resources', async () => {
  let calls = 0
  const cache = createDetailImageCache(async () => {
    if (++calls === 1) return new Promise(() => {})
    return { image: {}, dispose() {} }
  }, 2, 10)
  await assert.rejects(cache.request('stalled'), /timeout/)
  await cache.request('stalled')
  assert.equal(calls, 2)
  cache.clear()
  const released = []
  const lru = createDetailImageCache(async url => ({ image: {}, dispose: () => released.push(url) }), 2)
  await lru.request('a'); await lru.request('b'); lru.peek('a'); await lru.request('c')
  assert.deepEqual(released, ['b'])
  assert.equal(lru.peek('b'), undefined)
  lru.clear()
})

test('responsive detail sources use contain dimensions, cap density and handle older metadata', () => {
  const portrait = { width: 1, height: 2, image: 'legacy.webp', detailImages: [640, 1024, 1440].map(edge => ({ src: `${edge}.webp`, width: edge / 2, height: edge })) }
  assert.equal(selectDetailImage(portrait, 298, 278, 3), '640.webp')
  assert.equal(selectDetailImage(portrait, 414, 570, 2), '1440.webp')
  assert.equal(selectDetailImage({ ...portrait, width: 2, height: 1 }, 414, 570, 2), '1024.webp')
  assert.equal(selectDetailImage({ ...portrait, detailImages: undefined }, 414, 570, 2), 'legacy.webp')
})

test('generated detail tiers preserve aspect, reuse scene URLs and stay within a transfer budget', () => {
  const gallery = JSON.parse(readFileSync(new URL('../public/gallery.json', import.meta.url)))
  for (const art of gallery.artworks.filter(a => a.detailsEnabled)) {
    const variants = art.detailImages
    assert.ok(variants.length >= 2 && variants.length <= 3)
    assert.equal(variants[1].src, art.texture)
    const edges = variants.map(v => Math.max(v.width, v.height))
    assert.ok(edges.every((edge, i) => edge <= 1440 && (!i || edge > edges[i - 1])))
    for (const image of variants) {
      assert.ok(Math.abs(image.width / image.height - art.width / art.height) < .005)
      const file = readFileSync(new URL('../public/' + image.src, import.meta.url))
      assert.ok(file.length < 570_000, `${art.key}: ${file.length}`)
      assert.match(image.src, /\.(webp|jpg)$/)
    }
  }
})

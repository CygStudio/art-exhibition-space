import type { Artwork } from './artwork'

type Priority = 'high' | 'low'
export interface LoadedImage { image: HTMLImageElement; dispose(): void }
type LoadImage = (url: string, signal: AbortSignal, priority: Priority) => Promise<LoadedImage>

export function selectDetailImage(art: Artwork, width: number, height: number, density: number) {
  const images = art.detailImages
  if (!images?.length) return art.image // Also supports an older cached gallery.json.
  const ratio = art.width / art.height
  const fittedHeight = Math.min(height, width / ratio)
  const required = fittedHeight * Math.max(1, ratio) * Math.min(2, Math.max(1, density))
  return (images.find(image => Math.max(image.width, image.height) >= required) ?? images.at(-1)!).src
}

async function fetchImage(url: string, signal: AbortSignal, priority: Priority): Promise<LoadedImage> {
  const response = await fetch(url, { signal, priority })
  if (!response.ok) throw new Error(`Image HTTP ${response.status}`)
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const image = new Image()
  image.decoding = 'async'
  const abort = () => image.removeAttribute('src')
  signal.addEventListener('abort', abort, { once: true })
  try {
    signal.throwIfAborted()
    image.src = objectUrl
    await image.decode()
    signal.throwIfAborted()
    return { image, dispose: () => URL.revokeObjectURL(objectUrl) }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  } finally {
    signal.removeEventListener('abort', abort)
  }
}

/** Share foreground/preload work, cancel obsolete requests and bound decoded memory. */
export function createDetailImageCache(load: LoadImage = fetchImage, capacity = 8, timeoutMs = 15000) {
  type Entry = { controller: AbortController; promise: Promise<LoadedImage>; result?: LoadedImage }
  const entries = new Map<string, Entry>()
  function touch(url: string, entry: Entry) { entries.delete(url); entries.set(url, entry) }
  function request(url: string, priority: Priority = 'high') {
    const cached = entries.get(url)
    if (cached) { touch(url, cached); return cached.promise }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(new Error('Image timeout')), timeoutMs)
    const entry: Entry = { controller, promise: undefined! }
    // The abort race also bounds a stalled decode or an injected loader that ignores cancellation.
    const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true }))
    const loading = load(url, controller.signal, priority).then(result => {
      if (controller.signal.aborted) { result.dispose(); throw controller.signal.reason }
      return result
    })
    entry.promise = Promise.race([loading, aborted]).then(result => {
      entry.result = result
      for (const [key, old] of entries) {
        if ([...entries.values()].filter(e => e.result).length <= capacity) break
        if (old.result && old !== entry) { entries.delete(key); old.result.dispose() }
      }
      return result
    }).catch(error => {
      if (entries.get(url) === entry) entries.delete(url)
      throw error
    }).finally(() => clearTimeout(timeout))
    entries.set(url, entry)
    return entry.promise
  }
  return {
    request,
    peek(url: string) { const entry = entries.get(url); if (entry) touch(url, entry); return entry?.result },
    retain(urls: string[]) {
      for (const [url, entry] of entries) if (!entry.result && !urls.includes(url)) {
        entries.delete(url); entry.controller.abort(new DOMException('Superseded', 'AbortError'))
      }
    },
    clear() {
      for (const entry of entries.values()) { entry.controller.abort(); entry.result?.dispose() }
      entries.clear()
    },
  }
}

export interface DetailImageState {
  id: string
  phase: 'loading' | 'ready' | 'error'
  quality: 'empty' | 'preview' | 'full'
  image?: HTMLImageElement
  source?: string
}

/** A revision owns every callback; an earlier selection can never publish newer UI. */
export function createDetailImageSelection(cache: ReturnType<typeof createDetailImageCache>, publish: (state: DetailImageState) => void, preloadDelayMs = 350) {
  let revision = 0
  let preloadTimer: ReturnType<typeof setTimeout> | undefined
  function cancel() { revision++; clearTimeout(preloadTimer); cache.retain([]) }
  async function select(id: string, preview: string, source: string, neighbors: string[] = []) {
    const current = ++revision
    clearTimeout(preloadTimer)
    cache.retain([preview, source])
    let state: DetailImageState = { id, phase: 'loading', quality: 'empty' }
    function update(next: DetailImageState) {
      if (current !== revision) return
      state = next; publish(state)
    }
    update(state) // Synchronous reset before any network/decoded-image callback.
    const full = cache.peek(source)
    if (!full) {
      const thumb = cache.peek(preview)
      if (thumb) update({ ...state, quality: 'preview', image: thumb.image, source: preview })
      else void cache.request(preview).then(result => {
        if (current === revision && state.quality !== 'full') update({ ...state, quality: 'preview', image: result.image, source: preview })
      }).catch(() => { /* The main image may still succeed. */ })
    }
    try {
      const result = full ?? await cache.request(source)
      if (current !== revision) return
      update({ id, phase: 'ready', quality: 'full', image: result.image, source })
      cache.retain([source])
      // Only the adjacent pair, serially, after the foreground image is ready.
      preloadTimer = setTimeout(async () => {
        for (const url of [...new Set(neighbors)].filter(url => url !== source).slice(0, 2)) {
          if (current !== revision) return
          try { await cache.request(url, 'low') } catch { /* Speculation must not alter UI. */ }
        }
      }, preloadDelayMs)
    } catch {
      if (current === revision) update({ ...state, phase: 'error' })
    }
  }
  return { select, cancel }
}

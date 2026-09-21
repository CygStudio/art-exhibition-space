import type { Artwork } from './artwork'
import { createDetailImageCache, createDetailImageSelection, selectDetailImage } from './detail-image-loader'

export function createDetailImageView(dialog: HTMLDialogElement) {
  const stage = dialog.querySelector<HTMLElement>('#art-image-stage')!
  const status = dialog.querySelector<HTMLElement>('#art-image-status')!
  const retry = dialog.querySelector<HTMLButtonElement>('#retry-art-image')!
  const cache = createDetailImageCache()
  let active: Artwork | undefined
  let entries: Artwork[] = []
  let base = ''
  let intentTimer: ReturnType<typeof setTimeout> | undefined
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  const mayPreload = () => !connection?.saveData && !['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '')
  const selection = createDetailImageSelection(cache, state => {
    if (!active || state.id !== active.id || !dialog.open) return
    stage.dataset.artworkId = state.id
    stage.dataset.phase = state.phase
    stage.dataset.quality = state.quality
    stage.setAttribute('aria-busy', String(state.phase === 'loading'))
    if (state.image) {
      const image = state.image
      image.id = 'art-image'
      image.alt = `${active.title}，繪師：${active.artist}`
      image.dataset.source = state.source!
      if (stage.firstChild !== image) stage.replaceChildren(image)
    } else stage.replaceChildren()
    status.textContent = state.phase === 'error' ? (state.image ? '清晰圖片暫時無法載入，請重試。' : '圖片暫時無法載入，請重試。')
      : state.phase === 'loading' ? (state.image ? '正在載入清晰圖片…' : '正在載入作品…') : ''
    retry.hidden = state.phase !== 'error'
  })

  function source(art: Artwork, visible: boolean) {
    // The same contain box and density policy is used for display and speculation.
    const width = visible ? stage.clientWidth : innerWidth <= 600 ? innerWidth - 92 : Math.min(414, innerWidth / 2 - 60)
    const height = visible ? stage.clientHeight : innerHeight * (innerWidth <= 600 ? .33 : .60)
    return base + selectDetailImage(art, width, Math.min(height, innerWidth <= 600 ? height : 570), devicePixelRatio)
  }
  function show(art: Artwork, artworks: Artwork[], assetBase: string) {
    clearTimeout(intentTimer)
    active = art; entries = artworks; base = assetBase
    const index = artworks.findIndex(a => a.id === art.id)
    const neighbors = mayPreload() ? [artworks[(index + 1) % artworks.length]!, artworks[(index - 1 + artworks.length) % artworks.length]!]
      .map(a => source(a, true)) : []
    void selection.select(art.id, base + art.thumbnail, source(art, true), neighbors)
  }
  retry.addEventListener('click', () => { if (active && dialog.open) show(active, entries, base) })
  return {
    show,
    close() {
      clearTimeout(intentTimer); selection.cancel(); active = undefined
      stage.replaceChildren(); stage.removeAttribute('data-artwork-id')
      stage.dataset.phase = 'idle'; stage.dataset.quality = 'empty'; stage.setAttribute('aria-busy', 'false')
      status.textContent = ''; retry.hidden = true
    },
    prepare(art: Artwork, assetBase: string) {
      if (!mayPreload() || dialog.open) return
      clearTimeout(intentTimer); base = assetBase
      intentTimer = setTimeout(() => {
        const url = source(art, false)
        cache.retain([url])
        void cache.request(url, 'low').catch(() => {})
      }, 180)
    },
    cancelIntent() { clearTimeout(intentTimer); if (!dialog.open) cache.retain([]) },
  }
}

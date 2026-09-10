import type { Zone } from './stations'

export interface Artwork {
  id: string
  title: string
  zone: Zone
  image: string
  position: [number, number, number]
  rotation: number
  width: number
  height: number
  depth: number
  imageKind?: 'reference-photo'
  description: string
  medium: string
  detailsEnabled: boolean
  viewPosition?: [number, number, number]
}

/** Explicit opt-in: display-only artwork still renders and occludes picking. */
export function canOpenDetails(artwork: Pick<Artwork, 'detailsEnabled'> | undefined): boolean {
  return artwork?.detailsEnabled === true
}

export function getDetailArtworks(artworks: Artwork[]): Artwork[] {
  return artworks.filter(canOpenDetails)
}

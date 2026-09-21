import type { Zone } from './stations'

export interface ArtworkImage { src: string; width: number; height: number }

export interface Artwork {
  id: string
  title: string
  zone: Zone
  image: string
  texture: string
  thumbnail: string
  detailImages?: ArtworkImage[]
  position: [number, number, number]
  rotation: number
  width: number
  height: number
  depth: number
  imageKind: 'reference-photo' | 'original-artwork' | 'flat-vector'
  artist: string
  sourceFile: string
  sourceSize?: [number, number]
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

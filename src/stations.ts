export type Zone = 'north' | 'west' | 'east' | 'reception'

// Stand 3.8–5 m from the wall to see the surrounding collection, not a single frame.
export const stations: Record<Zone, { position: [number, number, number]; yaw: number }> = {
  north: { position: [.65, 1.65, -1.05], yaw: 0 },
  west: { position: [-.75, 1.65, .8], yaw: Math.PI / 2 },
  east: { position: [.75, 1.65, -.3], yaw: -Math.PI / 2 },
  reception: { position: [2.75, 1.65, 1.25], yaw: Math.PI },
}

export type Zone = 'south' | 'west' | 'east' | 'reception' | 'guestbook' | 'windows'

// Overview stations face the usable walls; signing and service stops face their desks.
export const stations: Record<Zone, { position: [number, number, number]; yaw: number }> = {
  south: { position: [0, 1.65, .4], yaw: Math.PI },
  west: { position: [-.7, 1.65, .8], yaw: Math.PI / 2 },
  east: { position: [3.5, 1.65, 2.7], yaw: 0 },
  reception: { position: [.1, 1.65, -.2], yaw: 0 },
  guestbook: { position: [-3.65, 1.65, -2.4], yaw: 0 },
  windows: { position: [1.2, 1.65, 2.2], yaw: -Math.PI / 2 },
}

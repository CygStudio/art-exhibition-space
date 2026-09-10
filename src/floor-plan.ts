interface Footprint { x: number; z: number; width: number; depth: number }
export interface Layout {
  outer: { minX: number; maxX: number; minZ: number; maxZ: number }
  entranceLobby: Footprint
  serviceDesk: Footprint
  guestbook: Footprint
  window: Footprint
  columns: Footprint[]
  heightRuler: { x: number; z: number; minCm: number; maxCm: number }
  entrance: { position: [number, number, number]; yaw: number; door: { x: number; z: number; width: number; height: number; wall: 'west' } }
}

// Use the exported model coordinates for both plan shapes and the live position marker.
export function mapPoint(x: number, z: number, layout: Layout) {
  const { minX, minZ, maxX } = layout.outer
  const scale = 104 / (maxX - minX)
  return { x: 8 + (x - minX) * scale, y: 8 + (z - minZ) * scale }
}
export function drawFloorPlan(group: SVGGElement, layout: Layout) {
  const scale = 104 / (layout.outer.maxX - layout.outer.minX)
  function rect(area: Footprint, fill: string, stroke = 'none') {
    const p = mapPoint(area.x - area.width / 2, area.z - area.depth / 2, layout)
    return `<rect x="${p.x}" y="${p.y}" width="${area.width * scale}" height="${area.depth * scale}" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`
  }
  const o = layout.outer
  const room = { x: (o.minX + o.maxX) / 2, z: (o.minZ + o.maxZ) / 2, width: o.maxX - o.minX, depth: o.maxZ - o.minZ }
  const door = layout.entrance.door
  const hinge = mapPoint(door.x, door.z - door.width / 2, layout)
  const radius = door.width * scale
  const window = mapPoint(layout.window.x, layout.window.z - layout.window.depth / 2, layout)
  group.innerHTML = rect(room, '#e5e0d6', '#9c978c')
    + rect(layout.entranceLobby, '#eeeae2', '#817e78')
    + rect(layout.serviceDesk, '#c66b68') + rect(layout.guestbook, '#78a883')
    + layout.columns.map(c => rect(c, '#68645f')).join('')
    + `<path d="M${window.x} ${window.y}v${layout.window.depth * scale}" stroke="#9d6fbd" stroke-width="4"/>`
    + `<path d="M${hinge.x} ${hinge.y}v${radius}" stroke="#eeeae2" stroke-width="3"/>`
    + `<path d="M${hinge.x} ${hinge.y}h${radius} A${radius} ${radius} 0 0 1 ${hinge.x} ${hinge.y+radius}" fill="none" stroke="#68645f" stroke-width="1.3"/>`
    + `<text x="${hinge.x+radius+7}" y="${hinge.y+radius/2+2}" text-anchor="middle" font-size="5.8" fill="#57534d">入口</text>`
}

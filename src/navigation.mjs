/** Circle versus axis-aligned scene obstacles. Coordinates are shared with Blender. */
export function canOccupy(x, z, bounds, colliders, radius = 0.24) {
  if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return false
  return !colliders.some(c => {
    const nearestX = Math.max(c.x - c.width / 2, Math.min(x, c.x + c.width / 2))
    const nearestZ = Math.max(c.z - c.depth / 2, Math.min(z, c.z + c.depth / 2))
    return (x - nearestX) ** 2 + (z - nearestZ) ** 2 < radius ** 2
  })
}

/** Small substeps prevent tunnelling even if a frame is delayed. Slide along obstacles. */
export function movePosition(position, dx, dz, bounds, colliders) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.1))
  let { x, z } = position
  for (let i = 0; i < steps; i++) {
    if (canOccupy(x + dx / steps, z, bounds, colliders)) x += dx / steps
    if (canOccupy(x, z + dz / steps, bounds, colliders)) z += dz / steps
  }
  return { x, z }
}

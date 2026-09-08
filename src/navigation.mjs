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

function distanceToSegmentSquared(point, start, end) {
  const dx=end.x-start.x, dz=end.z-start.z
  const length=dx*dx+dz*dz
  const t=length ? Math.max(0,Math.min(1,((point.x-start.x)*dx+(point.z-start.z)*dz)/length)) : 0
  return (point.x-start.x-t*dx)**2+(point.z-start.z-t*dz)**2
}

/** Swept camera-circle test: even a long route must clear the entire obstacle. */
export function segmentClear(start, end, bounds, colliders, radius = .24) {
  if (!canOccupy(start.x,start.z,bounds,colliders,radius) || !canOccupy(end.x,end.z,bounds,colliders,radius)) return false
  return colliders.every(c => {
    const minX=c.x-c.width/2, maxX=c.x+c.width/2, minZ=c.z-c.depth/2, maxZ=c.z+c.depth/2
    let enter=0, exit=1
    for (const [p,delta,min,max] of [[start.x,end.x-start.x,minX,maxX],[start.z,end.z-start.z,minZ,maxZ]]) {
      if (Math.abs(delta)<1e-10) { if (p<min||p>max) {enter=2;break} }
      else {const t1=(min-p)/delta,t2=(max-p)/delta;enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2))}
    }
    if (enter<=exit) return false
    return [[minX,minZ],[minX,maxZ],[maxX,minZ],[maxX,maxZ]].every(([x,z]) => distanceToSegmentSquared({x,z},start,end) >= radius*radius)
  })
}

/** Visibility graph around expanded obstacle corners; null means no safe route. */
export function findWalkPath(start, target, bounds, colliders) {
  if (!canOccupy(target.x,target.z,bounds,colliders)) return null
  const origin={x:start.x,z:start.z}, destination={x:target.x,z:target.z}
  if (segmentClear(origin,destination,bounds,colliders)) return [destination]
  const points=[origin,destination]
  for (const c of colliders) {
    for(const x of [c.x-c.width/2-.3,c.x+c.width/2+.3]) {
      for(const z of [c.z-c.depth/2-.3,c.z+c.depth/2+.3]) {
        if(canOccupy(x,z,bounds,colliders))points.push({x,z})
      }
    }
  }
  const distances=points.map(()=>Infinity), previous=points.map(()=>-1), visited=new Set()
  distances[0]=0
  while(visited.size<points.length) {
    let current=-1
    for(let i=0;i<points.length;i++)if(!visited.has(i)&&(current<0||distances[i]<distances[current]))current=i
    if(current<0||!Number.isFinite(distances[current]))return null
    if(current===1) {
      const route=[]
      for(let i=1;i!==0;i=previous[i])route.unshift(points[i])
      return route
    }
    visited.add(current)
    for(let next=0;next<points.length;next++) {
      if(visited.has(next)||!segmentClear(points[current],points[next],bounds,colliders))continue
      const candidate=distances[current]+Math.hypot(points[next].x-points[current].x,points[next].z-points[current].z)
      if(candidate<distances[next]){distances[next]=candidate;previous[next]=current}
    }
  }
  return null
}

import * as THREE from 'three'
import type { Artwork } from './artwork'

/** Preview materials arrive in the GLB; upgrades never block navigation. */
export function createArtworkTextures(
  entries: Artwork[], meshes: Map<string, THREE.Mesh>, base: string, anisotropy: number,
  load = (url: string) => new THREE.TextureLoader().loadAsync(url),
) {
  const pending = entries.map(art => ({ art, mesh: meshes.get(art.id)!, attempts: 0, retryAt: 0, loading: false, done: false }))
  const frustum = new THREE.Frustum()
  const projection = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const normal = new THREE.Vector3()
  let active = 0
  let lastUpdate = -Infinity
  let stopped = false

  function update(camera: THREE.PerspectiveCamera, now = performance.now()) {
    if (stopped || now - lastUpdate < 250) return
    lastUpdate = now
    camera.updateMatrixWorld()
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    const candidates = pending.filter(item => {
      if (item.done || item.loading || item.attempts >= 3 || item.retryAt > now) return false
      position.set(...item.art.position)
      const angle = THREE.MathUtils.degToRad(item.art.rotation)
      normal.set(Math.sin(angle), 0, Math.cos(angle))
      // Only request front-facing canvases within the current view.
      return normal.dot(position.clone().sub(camera.position)) < 0 && frustum.intersectsObject(item.mesh)
    }).sort((a, b) => camera.position.distanceToSquared(position.set(...a.art.position))
      - camera.position.distanceToSquared(normal.set(...b.art.position)))

    for (const item of candidates) {
      if (active >= 3) break
      active++; item.loading = true; item.attempts++
      load(base + item.art.texture).then(texture => {
        if (stopped) { texture.dispose(); return }
        texture.flipY = false // Match GLTF UV orientation, including folded canvas sides.
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = anisotropy
        const material = item.mesh.material as THREE.MeshBasicMaterial
        const preview = material.map
        material.map = texture
        material.needsUpdate = true
        item.mesh.userData.textureQuality = 'full'
        item.done = true
        preview?.dispose()
        // GLTFLoader uses ImageBitmap; disposing the GPU texture alone does not close it.
        if (typeof ImageBitmap !== 'undefined' && preview?.image instanceof ImageBitmap) preview.image.close()
      }).catch(() => {
        // Keep the preview usable and retry transient failures with backoff.
        item.retryAt = performance.now() + 2000 * 2 ** (item.attempts - 1)
      }).finally(() => { item.loading = false; active-- })
    }
  }
  return { update, stop() { stopped = true } }
}

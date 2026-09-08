import * as THREE from 'three'

/** Shared three-step ramp: preserve flat painted colors without realistic surface noise. */
export function createCelEnvironment() {
  const gradient = new THREE.DataTexture(new Uint8Array([48, 142, 245]), 3, 1, THREE.RedFormat)
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter
  gradient.generateMipmaps = false
  gradient.needsUpdate = true

  const palette: Record<string, string> = {
    'Warm plaster': '#eee5d9',
    'Painted structural steel': '#c7c9d1',
    'Exhibition panels': '#fff1de',
    'Charcoal metal': '#484656',
    'Panel seams': '#aca3ad',
    'Ochre table linen': '#dfba8c',
    'Paper labels': '#fff7e8',
    'Concrete': '#d6d0dc',
    'Lamp diffuser': '#fff2c9',
    'Window glass': '#849dad',
    'Exterior ambient': '#657785',
    'Exhibition accent': '#c88691',
  }
  const materials = new Map<string, THREE.MeshToonMaterial>()
  const ink = new THREE.LineBasicMaterial({ color: '#635c72', transparent: true, opacity: .28, depthWrite: false })
  function materialFor(source: THREE.Material) {
    let material = materials.get(source.name)
    if (!material) {
      material = new THREE.MeshToonMaterial({
        name: `Cel ${source.name}`,
        color: palette[source.name] ?? '#e1d9d1',
        gradientMap: gradient,
      })
      if (source.name === 'Window glass') {
        material.transparent = true
        material.opacity = .3
        material.depthWrite = false
      }
      if (source.name === 'Exterior ambient') {
        material.emissive.set('#657785')
        material.emissiveIntensity = .5
      }
      if (source.name === 'Lamp diffuser') {
        material.emissive.set('#fff1c7')
        material.emissiveIntensity = .45
      }
      materials.set(source.name, material)
    }
    return material
  }

  function apply(root: THREE.Object3D) {
    const meshes: THREE.Mesh[] = []
    root.traverse(o => { if (o instanceof THREE.Mesh && !o.userData.artworkId) meshes.push(o) })
    // Do not add children while traversing. Outlines never participate in picking.
    for (const mesh of meshes) {
      const original = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mesh.userData.walkable = original.some(m => m.name === 'Concrete')
      mesh.material = original.length === 1 ? materialFor(original[0]) : original.map(materialFor)
      if (original.some(m => ['Paper labels', 'Lamp diffuser', 'Concrete', 'Window glass', 'Exterior ambient'].includes(m.name))) continue
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 55), ink)
      edges.name = 'Cel architectural ink'
      edges.userData.solid = false
      edges.raycast = () => {}
      mesh.add(edges)
    }
  }

  function light(scene: THREE.Scene, colliders: {x:number;z:number;width:number;depth:number}[]) {
    scene.add(new THREE.HemisphereLight('#f4eeff', '#b2a5c8', .55))
    scene.add(new THREE.AmbientLight('#fffaf3', .65))
    const key = new THREE.DirectionalLight('#fff4e7', 1.7)
    key.position.set(-3, 7, 4)
    scene.add(key)

    // Flat translucent shadow shapes replace photographic radial gradients.
    const contact = new THREE.MeshBasicMaterial({color:'#706780',transparent:true,opacity:.12,depthWrite:false})
    for (const c of colliders) {
      if (c.width > 3 && c.depth > 3) continue
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 12), contact)
      shadow.rotation.x = -Math.PI / 2
      shadow.scale.set(c.width * .65 + .25, c.depth * .65 + .25, 1)
      shadow.position.set(c.x + .12, .006, c.z - .08)
      shadow.userData.solid = false
      shadow.raycast = () => {}
      scene.add(shadow)
    }
  }
  return { apply, light }
}

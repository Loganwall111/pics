/**
 * Building Geometry Utilities - Generates varied building meshes with LOD
 */
import * as THREE from 'three'

export function createBuildingGeometry(width: number, height: number, depth: number, detail = 1): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(width, height, depth)
  // Add window subdivisions via vertex colors or UVs
  const uv = geo.attributes.uv as THREE.BufferAttribute
  // Scale UVs for window texture tiling
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i)
    const v = uv.getY(i)
    uv.setXY(i, u * (width / 4), v * (height / 4))
  }
  uv.needsUpdate = true
  return geo
}

export function createLODs(baseGeo: THREE.BufferGeometry): THREE.LOD {
  const lod = new THREE.LOD()
  const mat = new THREE.MeshStandardMaterial({ color: '#333344' })

  const meshHigh = new THREE.Mesh(baseGeo, mat)
  lod.addLevel(meshHigh, 0)

  const lowGeo = new THREE.BoxGeometry(
    (baseGeo as any).parameters?.width || 10,
    (baseGeo as any).parameters?.height || 20,
    (baseGeo as any).parameters?.depth || 10
  )
  const meshLow = new THREE.Mesh(lowGeo, mat)
  lod.addLevel(meshLow, 100)

  return lod
}

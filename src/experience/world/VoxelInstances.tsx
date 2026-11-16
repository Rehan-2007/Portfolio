import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import type { VoxelBatchData } from './voxelTypes'

interface VoxelInstancesProps {
  batch: VoxelBatchData
  geometry: THREE.BoxGeometry
  material: THREE.Material
  frustumCulled?: boolean
}

export function VoxelInstances({ batch, geometry, material, frustumCulled = true }: VoxelInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const matrices = mesh.instanceMatrix.array
    for (let i = 0; i < batch.count; i++) {
      const p = i * 6
      const m = i * 16
      matrices[m] = batch.transforms[p + 3]
      matrices[m + 5] = batch.transforms[p + 4]
      matrices[m + 10] = batch.transforms[p + 5]
      matrices[m + 12] = batch.transforms[p]
      matrices[m + 13] = batch.transforms[p + 1]
      matrices[m + 14] = batch.transforms[p + 2]
      matrices[m + 15] = 1
    }
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor = new THREE.InstancedBufferAttribute(batch.colors, 3).setUsage(THREE.StaticDrawUsage)
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
    // Shared geometry/materials belong to the parent, per-instance buffers to this mesh.
    return () => mesh.dispose()
  }, [batch, geometry, material])

  return batch.count ? (
    <instancedMesh ref={meshRef} args={[geometry, material, batch.count]} castShadow={false} receiveShadow={false} frustumCulled={frustumCulled} dispose={null} />
  ) : null
}

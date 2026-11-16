import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { QualityLevel } from '../../stores/useExperienceStore'
import { useScenePreparation } from '../../stores/useScenePreparation'
import { VOXEL_WORLD } from '../../config/voxelWorld'
import { VoxelInstances } from './VoxelInstances'
import { createBlockGeometry, createVoxelTexture } from './voxelMaterials'
import { useVoxelChunks } from './useVoxelChunks'

interface VoxelTerrainProps { quality: QualityLevel }

export function VoxelTerrain({ quality }: VoxelTerrainProps) {
  const world = useVoxelChunks(quality)
  const renderer = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const terrainRef = useRef<THREE.Group>(null)
  const blockGeometry = useMemo(() => createBlockGeometry(), [])
  const texture = useMemo(() => createVoxelTexture(), [])
  const solidMaterial = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, map: texture, roughness: 0.95, metalness: 0, flatShading: true }), [texture])
  const waterMaterial = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.04, transparent: true, opacity: 0.87, depthWrite: false }), [])
  const lastTelemetry = useRef(0)

  useEffect(() => () => { blockGeometry.dispose(); solidMaterial.dispose(); waterMaterial.dispose(); texture.dispose() }, [blockGeometry, solidMaterial, texture, waterMaterial])

  useEffect(() => {
    const preparation = useScenePreparation.getState()
    preparation.begin(quality)
    preparation.terrainProgress(world.generated, world.total, world.error)
    if (!world.preparing && world.quality === quality) preparation.terrainCommitted(quality)
  }, [quality, world.error, world.generated, world.preparing, world.quality, world.total])

  useFrame(({ clock }) => {
    if (!import.meta.env.DEV || clock.elapsedTime - lastTelemetry.current < 0.5) return
    lastTelemetry.current = clock.elapsedTime
    let casters = 0
    let receivers = 0
    scene.traverse((item) => { if (item.castShadow) casters++; if (item.receiveShadow) receivers++ })
    const counts = world.chunks.reduce((sum, chunk) => sum + chunk.count, 0)
    Object.assign(window, {
      __ANTI_AI_VOXELS__: { extent: VOXEL_WORLD.halfExtent * 2, quality, generated: world.generated, total: world.total, detailed: world.detailed, cached: world.cached, counts, generationMs: Math.round(world.generationMs), error: world.error },
      __ANTI_AI_RENDER__: { ...renderer.info.render, ...renderer.info.memory, shadows: renderer.shadowMap.enabled, casters, receivers },
    })
  })

  return (
    <group ref={terrainRef} name="Complete resident voxel landscape">
      {world.chunks.map((chunk) => (
        <group key={chunk.key} name={`Chunk ${chunk.key}`} userData={{ centre: chunk.centre, radius: chunk.radius }}>
          {chunk.batches.map((batch) => <VoxelInstances key={batch.kind} batch={batch} geometry={blockGeometry} material={batch.kind === 'water' ? waterMaterial : solidMaterial} />)}
        </group>
      ))}
    </group>
  )
}

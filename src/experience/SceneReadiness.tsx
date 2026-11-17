import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ESSENTIAL_MODELS, readinessPrerequisites } from '../lib/sceneReadiness'
import { useModelAssets } from '../stores/useModelAssets'
import { useScenePreparation } from '../stores/useScenePreparation'
import { useExperienceStore } from '../stores/useExperienceStore'

/** GPU work happens under the opaque DOM loader; no additional RAF/controller. */
export function SceneReadiness({ onReady }: { onReady: () => void }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const quality = useExperienceStore((state) => state.settings.quality)
  const preparation = useScenePreparation()
  const assets = useModelAssets((state) => state.statuses)
  const revisions = useModelAssets((state) => state.revisions)
  const lastSignature = useRef('')
  const warming = useRef(false)
  const revisionKey = ESSENTIAL_MODELS.map((id) => `${id}:${revisions[id] ?? 0}`).join('|')

  useEffect(() => {
    useScenePreparation.getState().begin(quality)
    useExperienceStore.getState().setPhase('loading')
    return () => { lastSignature.current = '' }
  }, [quality])

  useEffect(() => {
    if (preparation.error) return
    const gate = readinessPrerequisites({ rendererReady: preparation.rendererReady, terrainComplete: preparation.terrainQuality === quality && preparation.terrainCompleted === preparation.terrainTotal, statuses: assets, revisions })
    if (gate.error) { useScenePreparation.getState().fail(gate.error); return }
    if (!gate.ready) return
    const signature = `${quality}:${preparation.epoch}:${revisionKey}`
    if (lastSignature.current === signature || warming.current) return
    let cancelled = false
    const epoch = preparation.epoch
    warming.current = true
    useScenePreparation.getState().warming()
    useExperienceStore.getState().setPhase('loading')
    const warm = async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined
      const culling: Array<[THREE.Object3D, boolean]> = []
      try {
        // Allow all React layout effects (including instance matrices and cube rig) to commit.
        await new Promise((resolve) => setTimeout(resolve, 30))
        if (cancelled || gl.getContext().isContextLost()) return
        const textures = new Set<THREE.Texture>()
        scene.traverse((object) => {
          const mesh = object as THREE.Mesh
          if (!mesh.isMesh && !(object as THREE.Points).isPoints) return
          culling.push([object, object.frustumCulled])
          object.frustumCulled = false
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const material of materials) if (material) for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
        })
        if (scene.environment) textures.add(scene.environment)
        for (const texture of textures) gl.initTexture(texture)
        const bounded = new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Graphics preparation exceeded 30 seconds. Try a lower graphics setting.')), 30000) })
        await Promise.race([gl.compileAsync(scene, camera), bounded])
        if (cancelled || gl.getContext().isContextLost()) return
        // Submit every resident mesh once before reveal, including distant instance buffers.
        gl.render(scene, camera)
        culling.forEach(([object, value]) => { object.frustumCulled = value })
        gl.render(scene, camera)
        await new Promise((resolve) => setTimeout(resolve, 20))
        if (!cancelled && useScenePreparation.getState().epoch === epoch) {
          lastSignature.current = signature
          useScenePreparation.getState().complete(epoch)
          useExperienceStore.getState().markSceneReady()
          useExperienceStore.getState().setPhase('flying')
          onReady()
          if (import.meta.env.DEV) Object.assign(window, { __ANTI_AI_REVEAL__: { signature, essential: ESSENTIAL_MODELS.length, textures: textures.size, terrain: preparation.terrainTotal, warmed: true } })
        }
      } catch (error) {
        if (!cancelled) useScenePreparation.getState().fail(error instanceof Error ? error.message : String(error))
      } finally {
        clearTimeout(timeout)
        culling.forEach(([object, value]) => { object.frustumCulled = value })
        warming.current = false
      }
    }
    void warm()
    return () => { cancelled = true }
  }, [assets, camera, gl, onReady, preparation.epoch, preparation.error, preparation.rendererReady, preparation.terrainCompleted, preparation.terrainQuality, preparation.terrainTotal, quality, revisionKey, revisions, scene])
  return null
}

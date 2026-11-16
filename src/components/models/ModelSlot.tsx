import { Suspense, use, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useAnimations } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { startModelAnimation } from '../../lib/modelAnimation'
import { MODEL_CONFIG, validateModelConfig } from '../../config/models'
import type { ModelConfig, ModelId } from '../../config/models'
import { useExperienceStore } from '../../stores/useExperienceStore'
import { useModelAssets } from '../../stores/useModelAssets'
import { useEffects } from '../../stores/useEffects'
import { prepareModel } from '../../lib/modelAssets'
import { getModelResource } from '../../lib/modelResource'
import { ModelErrorBoundary } from './ModelErrorBoundary'
import { CubeController } from './CubeController'
import { LaptopScreen } from './LaptopScreen'

function LoadingModel({ id, fallback }: { id: ModelId; fallback: ReactNode }) {
  useEffect(() => { useModelAssets.getState().setStatus(id, { phase: 'loading' }) }, [id])
  return fallback
}

function LoadedModel({ config, revision }: { config: ModelConfig; revision: number }) {
  const gltf = use(getModelResource(config.assetPath!, config.decoder.dracoPath, revision))
  const gl = useThree((state) => state.gl)
  const model = useMemo(() => prepareModel(gltf, gl.capabilities.getMaxAnisotropy(), config.id === 'archive'), [config.id, gltf, gl])
  const { actions } = useAnimations(gltf.animations, model.scene)
  const reducedMotion = useExperienceStore((state) => state.settings.reducedMotion)
  useEffect(() => {
    const warnings = [...model.inspection.warnings]
    if (config.animation.clip && !actions[config.animation.clip]) warnings.push(`Animation clip not found: ${config.animation.clip}`)
    for (const node of Object.keys(config.faceNodes)) if (!model.scene.getObjectByName(node)) warnings.push(`Face node not found: ${node}`)
    useModelAssets.getState().setStatus(config.id, { phase: 'ready', revision, inspection: { ...model.inspection, warnings } })
    if (import.meta.env.DEV) Object.assign(window, { __ANTI_AI_MODEL_STATUS__: useModelAssets.getState().statuses })
    return () => model.dispose()
  }, [actions, config, model, revision])
  useEffect(() => {
    if (!config.animation.autoplay || !config.animation.clip || reducedMotion) return
    const action = actions[config.animation.clip]
    if (!action) return
    return startModelAnimation(action, config.animation)
  }, [actions, config.animation, reducedMotion])
  useFrame(({ clock }, delta) => {
    if (config.id !== 'shawarma') return
    const selected = useExperienceStore.getState().activeStation === 'shawarma' && !reducedMotion
    const target = selected ? Math.sin(clock.elapsedTime * 2.2) * 0.022 : 0
    model.scene.rotation.set(0, 0, model.scene.rotation.z + (target - model.scene.rotation.z) * (1 - Math.exp(-5 * delta)))
  })
  const interact = (event: ThreeEvent<MouseEvent>) => {
    if (useEffects.getState().enabled) return
    const target = event.nativeEvent.target
    if (target instanceof Element && target.closest('button, a, input, textarea, select, dialog')) return
    if (!config.interaction.enabled || !config.interaction.station) return
    event.stopPropagation()
    let object = event.object
    let face: string | null = null
    while (object && !face) { face = config.faceNodes[object.name] ?? null; object = object.parent! }
    useModelAssets.getState().selectFace(face)
    useExperienceStore.getState().openStation(config.interaction.station)
  }
  return (
    <group position={config.position} rotation={config.rotation} scale={config.scale} visible={config.visible} onClick={interact}>
      {config.id === 'cube' ? <CubeController scene={model.scene} /> : <primitive object={model.scene} dispose={null} />}
      {config.id === 'about' && <LaptopScreen />}
    </group>
  )
}

interface ModelSlotProps { id: ModelId; fallback?: ReactNode }

export function ModelSlot({ id, fallback = null }: ModelSlotProps) {
  const config = MODEL_CONFIG[id]
  const revision = useModelAssets((state) => state.revisions[id] ?? 0)
  const invalid = validateModelConfig(config)
  useEffect(() => {
    if (invalid) useModelAssets.getState().setStatus(id, { phase: 'error', revision, message: invalid })
  }, [id, invalid, revision])
  if (!config.visible) return null
  if (!config.assetPath || invalid) return fallback
  return (
    <ModelErrorBoundary key={`${id}:${config.assetPath}:${revision}`} id={id} fallback={fallback}>
      <Suspense fallback={<LoadingModel id={id} fallback={fallback} />}>
        <LoadedModel config={config} revision={revision} />
      </Suspense>
    </ModelErrorBoundary>
  )
}

export function LandmarkModels() {
  return <group name="Configured real-model slots">{(['about', 'cube', 'lab', 'archive', 'contact', 'shawarma', 'environment'] as ModelId[]).map((id) => <ModelSlot key={id} id={id} />)}</group>
}

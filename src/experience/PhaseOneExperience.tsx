import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { WorldEnvironment } from './WorldEnvironment'
import { FlightSystems } from './FlightSystems'
import { FollowCamera } from './FollowCamera'
import { ContextGuard } from './ContextGuard'
import { FrameDriver } from './FrameDriver'
import { ReflectionEnvironment } from './ReflectionEnvironment'
import { AircraftEffects } from './AircraftEffects'
import { FlightAudio } from '../audio/FlightAudio'
import { AudioEngine } from '../audio/AudioEngine'
import { SceneReadiness } from './SceneReadiness'
import { useScenePreparation } from '../stores/useScenePreparation'
import { useExperienceStore } from '../stores/useExperienceStore'
import { VOXEL_QUALITY } from '../config/voxelWorld'

interface PhaseOneExperienceProps {
  onReady: () => void
  onContextLost: () => void
  onContextRestored: () => void
}

/**
 * Some embedded Chromium surfaces do not emit ResizeObserver's initial entry.
 * R3F waits for that first measurement before it creates the renderer root, so
 * delegate normal observation and guarantee one asynchronous first callback.
 */
class InitialResizeObserver {
  private readonly nativeObserver: ResizeObserver
  private readonly callback: ResizeObserverCallback
  private readonly targets = new Set<Element>()

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    this.nativeObserver = new ResizeObserver(callback)
  }

  observe(target: Element, options?: ResizeObserverOptions): void {
    this.targets.add(target)
    this.nativeObserver.observe(target, options)
    window.setTimeout(() => {
      if (this.targets.has(target)) {
        this.callback([], this as unknown as ResizeObserver)
      }
    }, 0)
  }

  unobserve(target: Element): void {
    this.targets.delete(target)
    this.nativeObserver.unobserve(target)
  }

  disconnect(): void {
    this.targets.clear()
    this.nativeObserver.disconnect()
  }
}

export default function PhaseOneExperience({
  onReady,
  onContextLost,
  onContextRestored,
}: PhaseOneExperienceProps) {
  const quality = useExperienceStore((state) => state.settings.quality)
  const qualityConfig = VOXEL_QUALITY[quality]
  const dpr = qualityConfig.dpr

  return (
    <Canvas
      className="flight-canvas"
      resize={{ polyfill: InitialResizeObserver }}
      eventSource={document.getElementById('root')!}
      eventPrefix="client"
      shadows={false}
      dpr={dpr as [number, number]}
      camera={{ position: [0, 82, 350], fov: 55, near: 0.5, far: 19000 }}
      gl={{
        antialias: quality !== 'low',
        alpha: false,
        powerPreference: quality === 'low' ? 'low-power' : 'high-performance',
        stencil: false,
        depth: true,
      }}
      frameloop="never"
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = false
        gl.outputColorSpace = THREE.SRGBColorSpace
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.setClearColor('#d88c75')
      }}
    >
      <ReflectionEnvironment />
      <WorldEnvironment quality={quality} />
      <FlightSystems />
      <FollowCamera />
      <AircraftEffects onFire={(event) => AudioEngine.fire(event.origins[0])} onImpact={(event) => AudioEngine.impact(event)} />
      <FlightAudio />
      <FrameDriver />
      <SceneReadiness onReady={onReady} />
      <ContextGuard
        onLost={onContextLost}
        onRestored={onContextRestored}
        onReady={useScenePreparation.getState().measured}
      />
    </Canvas>
  )
}

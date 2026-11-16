import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AIRCRAFT_SIZE } from '../config/aircraft'
import { flight, flightEvents } from '../lib/flight'
import {
  EFFECTS_CONFIG, PROJECTILE_CAPACITY, IMPACT_CAPACITY,
  effectsInput, projectilePool, transformEffectsVector,
} from '../lib/projectiles'
import type { EffectCallbacks, EffectsInput, EffectsVector } from '../lib/projectiles'
import { experienceSnapshot } from '../stores/useExperienceStore'
import { useModelAssets } from '../stores/useModelAssets'
import { resetEffects, useEffects } from '../stores/useEffects'

export interface AircraftEffectsProps extends EffectCallbacks {
  /** Pass the parent's shared actionInput; no keyboard or mouse listeners are installed here. */
  input?: EffectsInput
  aircraftReady?: boolean
  reducedMotion?: boolean
}

/** Mount once at scene/world level, not under the moving aircraft group.
 * Fictional decorative light streaks and pooled floor-contact puffs only.
 * Audio remains optional and belongs to the parent via onFire/onImpact.
 */
export function AircraftEffects({ input = effectsInput, aircraftReady, reducedMotion, onFire, onImpact }: AircraftEffectsProps) {
  const root = useRef<THREE.Group>(null)
  const streaks = useRef<THREE.InstancedMesh>(null)
  const puffs = useRef<THREE.InstancedMesh>(null)
  const leftMuzzle = useRef<THREE.Mesh>(null)
  const rightMuzzle = useRef<THREE.Mesh>(null)
  const leftBoost = useRef<THREE.Mesh>(null)
  const rightBoost = useRef<THREE.Mesh>(null)
  const resetVersion = useRef(flightEvents.resetVersion)
  const scratch = useMemo(() => ({
    dummy: new THREE.Object3D(),
    direction: new THREE.Vector3(),
    zAxis: new THREE.Vector3(0, 0, 1),
    color: new THREE.Color(),
    world: { x: 0, y: 0, z: 0 } as EffectsVector,
    localForward: { x: 0, y: 0, z: -1 },
    localBoost: [
      { x: -0.12 * AIRCRAFT_SIZE.span, y: 0, z: 0.35 * AIRCRAFT_SIZE.chord },
      { x: 0.12 * AIRCRAFT_SIZE.span, y: 0, z: 0.35 * AIRCRAFT_SIZE.chord },
    ],
  }), [])

  useEffect(() => () => resetEffects(), [])
  // Priority zero runs after FlightSystems (-2) and FollowCamera (-1), and never
  // takes over the canvas renderer. No second clock or requestAnimationFrame.
  useFrame((_, delta) => {
    if (resetVersion.current !== flightEvents.resetVersion) {
      resetVersion.current = flightEvents.resetVersion
      resetEffects()
    }
    const ready = aircraftReady ?? (useModelAssets.getState().statuses.aircraft?.phase === 'ready')
    const reduce = reducedMotion ?? experienceSnapshot().settings.reducedMotion
    const enabled = useEffects.getState().enabled
    if (projectilePool.state.enabled !== enabled) projectilePool.setEnabled(enabled)
    projectilePool.update(delta, input, flight, { ready, onFire, onImpact })
    if (import.meta.env.DEV) Object.assign(window, { __ANTI_AI_EFFECTS__: { ...projectilePool.state, activeProjectiles: projectilePool.activeProjectiles, activeImpacts: projectilePool.activeImpacts, capacity: PROJECTILE_CAPACITY, origins: projectilePool.muzzles.map((point) => ({ ...point })), forward: { ...projectilePool.forward } } })
    if (root.current) root.current.visible = ready && (enabled || flight.boosting)

    const { dummy, direction, zAxis, color } = scratch
    let count = 0
    if (streaks.current) {
      for (const p of projectilePool.projectiles) {
        if (!p.active) continue
        direction.set(p.vx, p.vy, p.vz).normalize()
        const length = reduce ? 10 : 34
        // A centered box is moved half its length behind the contact point.
        dummy.position.set(p.x - direction.x * length / 2, p.y - direction.y * length / 2, p.z - direction.z * length / 2)
        dummy.quaternion.setFromUnitVectors(zAxis, direction)
        dummy.scale.set(1.3, 1.3, length)
        dummy.updateMatrix()
        streaks.current.setMatrixAt(count++, dummy.matrix)
      }
      streaks.current.count = count
      streaks.current.instanceMatrix.needsUpdate = true
    }
    count = 0
    if (puffs.current) {
      if (!reduce) for (const p of projectilePool.impacts) {
        if (!p.active) continue
        const progress = Math.min(1, p.age / EFFECTS_CONFIG.impactLife)
        const radius = 1.6 + progress * 6
        dummy.position.set(p.x, p.y + progress * 1.5, p.z)
        dummy.quaternion.identity()
        dummy.scale.set(radius, radius * 0.5, radius)
        dummy.updateMatrix()
        puffs.current.setMatrixAt(count, dummy.matrix)
        color.setRGB(0.35 * (1 - progress), 0.64 * (1 - progress), 0.7 * (1 - progress))
        puffs.current.setColorAt(count++, color)
      }
      puffs.current.count = count
      puffs.current.instanceMatrix.needsUpdate = true
      if (puffs.current.instanceColor) puffs.current.instanceColor.needsUpdate = true
    }
    direction.set(0, 0, -1)
    const boostDirection = transformEffectsVector(scratch.localForward, flight, scratch.world)
    direction.set(boostDirection.x, boostDirection.y, boostDirection.z)
    const showMuzzle = enabled && ready && !flight.frozen && !reduce && projectilePool.muzzleRemaining > 0
    for (let wing = 0; wing < 2; wing++) {
      const muzzle = wing === 0 ? leftMuzzle.current : rightMuzzle.current
      if (muzzle) {
        muzzle.visible = showMuzzle
        const origin = projectilePool.muzzles[wing]
        muzzle.position.set(origin.x, origin.y, origin.z)
        muzzle.scale.setScalar(1.5 + 1.8 * projectilePool.muzzleRemaining / EFFECTS_CONFIG.muzzleLife)
      }
      const boost = wing === 0 ? leftBoost.current : rightBoost.current
      if (boost) {
        boost.visible = ready && !flight.frozen && !reduce && (flight.boosting ?? input.boost ?? false)
        if (boost.visible) {
          const position = transformEffectsVector(scratch.localBoost[wing], flight, scratch.world)
          boost.position.set(flight.x + position.x, flight.y + position.y, flight.z + position.z)
          boost.quaternion.setFromUnitVectors(zAxis, direction)
          // Subtle engine-colored streaks, not extra lights or shadow casters.
          boost.scale.set(1.6, 1.2, 9 + Math.sin(flight.time * 8 + wing) * 1.2)
        }
      }
    }
  }, 0)

  return (
    <group ref={root} name="Opt-in fictional aircraft light effects" visible={false}>
      <instancedMesh ref={streaks} args={[undefined, undefined, PROJECTILE_CAPACITY]} count={0} frustumCulled={false} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#abf4ff" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={puffs} args={[undefined, undefined, IMPACT_CAPACITY]} count={0} frustumCulled={false} castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.42} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <mesh ref={leftMuzzle} visible={false} castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#c2f7ff" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={rightMuzzle} visible={false} castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#c2f7ff" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={leftBoost} visible={false} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#91dfee" transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={rightBoost} visible={false} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#91dfee" transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

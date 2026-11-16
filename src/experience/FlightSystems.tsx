import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { STATIONS } from '../config/stations'
import { stationProximity, teleportAircraft } from '../lib/flightNavigation'
import type { StationId } from '../config/stations'
import { useKeyboard, virtualInput } from '../hooks/useKeyboard'
import { clamp } from '../lib/math'
import { flight, updateFlight } from '../lib/flight'
import {
  experienceSnapshot,
  useExperienceStore,
} from '../stores/useExperienceStore'
import { ModelSlot } from '../components/models/ModelSlot'
import { useModelAssets } from '../stores/useModelAssets'
import { actionInput, useSimulatorActions } from '../hooks/useSimulatorActions'
import { useScenePreparation } from '../stores/useScenePreparation'

function axis(positive: boolean, negative: boolean, virtual: number): number {
  return clamp((positive ? 1 : 0) - (negative ? 1 : 0) + virtual, -1, 1)
}

export function FlightSystems() {
  const worldTransform = useRef<THREE.Group>(null)
  const attitudeTransform = useRef<THREE.Group>(null)
  const keyboard = useKeyboard()
  useSimulatorActions()
  const lastNearby = useRef<StationId | null>(null)

  useFrame((_, frameDelta) => {
    const store = experienceSnapshot()
    const dt = Math.min(frameDelta, 0.1)

    if (store.teleportTarget) {
      teleportAircraft(store.teleportTarget)
      useExperienceStore.getState().clearTeleport()
    }

    const currentStore = experienceSnapshot()
    flight.mode = currentStore.flightMode
    flight.frozen = !useScenePreparation.getState().ready || currentStore.paused || currentStore.uiOpen || useModelAssets.getState().statuses.aircraft?.phase !== 'ready'

    const input = {
      boost: !!actionInput.boost,
      throttle: axis(
        keyboard.down('KeyW') || keyboard.down('ArrowUp'),
        keyboard.down('KeyS') || keyboard.down('ArrowDown'),
        virtualInput.throttle,
      ),
      turn: axis(
        keyboard.down('KeyD') || keyboard.down('ArrowRight'),
        keyboard.down('KeyA') || keyboard.down('ArrowLeft'),
        virtualInput.turn,
      ),
      vertical: axis(
        keyboard.down('KeyE'),
        keyboard.down('KeyQ'),
        virtualInput.vertical,
      ),
    }

    updateFlight(input, dt, store.settings.reducedMotion)

    if (import.meta.env.DEV) {
      ;(window as Window & { __ANTI_AI_FLIGHT__?: typeof flight }).__ANTI_AI_FLIGHT__ = flight
    }

    if (worldTransform.current) {
      worldTransform.current.position.set(flight.x, flight.y, flight.z)
      worldTransform.current.rotation.y = -flight.heading
    }
    if (attitudeTransform.current) {
      attitudeTransform.current.rotation.x = flight.pitch
      attitudeTransform.current.rotation.z = flight.roll
    }

    let nearby: StationId | null = null
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const station of STATIONS) {
      const dx = flight.x - station.pos[0]
      const dz = flight.z - station.pos[2]
      const distance = Math.hypot(dx, dz)
      if (distance < nearestDistance && stationProximity(station.id, flight.x, flight.y, flight.z)) {
        nearby = station.id
        nearestDistance = distance
      }
    }
    if (nearby !== lastNearby.current) {
      lastNearby.current = nearby
      useExperienceStore.getState().setNearby(nearby)
    }
  }, -2)

  return (
    <group ref={worldTransform}>
      <group ref={attitudeTransform}>
        <ModelSlot id="aircraft" />
      </group>
    </group>
  )
}

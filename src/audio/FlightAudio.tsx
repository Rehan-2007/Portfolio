import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { ACTIVE_AIRCRAFT } from '../config/aircraft'
import { flight, flightEvents } from '../lib/flight'
import { useExperienceStore } from '../stores/useExperienceStore'
import { AudioEngine } from './AudioEngine'
import type { AudioListenerFrame, FlightAudioFrame } from './AudioEngine'

/** Mount once inside Canvas. Uses FrameDriver's loop; never starts/resumes an AudioContext. */
export function FlightAudio() {
  const grounded = useRef<boolean | null>(null)
  const resetVersion = useRef(flightEvents.resetVersion)
  const direction = useRef(new Vector3())
  const cameraPosition = useRef(new Vector3())
  const frame = useRef<FlightAudioFrame>({ speedNorm: 0, throttle: 0, boosting: false, paused: true, x: 0, y: 0, z: 0, heading: 0 })
  const listener = useRef<AudioListenerFrame>({ x: 0, y: 0, z: 0, forwardX: 0, forwardY: 0, forwardZ: -1 })
  useEffect(() => {
    // The simulation may stop rendering while paused: silence immediately via the store too.
    const syncPause = () => {
      const state = useExperienceStore.getState()
      AudioEngine.setPaused(state.paused || state.uiOpen || state.phase !== 'flying')
    }
    syncPause()
    const unsubscribe = useExperienceStore.subscribe(syncPause)
    return () => { unsubscribe(); AudioEngine.stop() }
  }, [])
  useFrame(({ camera }) => {
    const store = useExperienceStore.getState()
    // Optional fields allow this component to coexist with flight-model changes during integration.
    const current = flight as typeof flight & Partial<{ throttle: number; boosting: boolean; grounded: boolean }>
    const state = frame.current
    state.speedNorm = current.speed / ACTIVE_AIRCRAFT.flight.maxSpeed
    state.throttle = current.throttle ?? state.speedNorm
    state.boosting = current.boosting ?? false
    state.paused = current.frozen || store.paused || store.uiOpen || store.phase !== 'flying'
    state.x = current.x; state.y = current.y; state.z = current.z; state.heading = current.heading
    camera.getWorldDirection(direction.current)
    camera.getWorldPosition(cameraPosition.current)
    const ear = listener.current
    ear.x = cameraPosition.current.x; ear.y = cameraPosition.current.y; ear.z = cameraPosition.current.z
    ear.forwardX = direction.current.x; ear.forwardY = direction.current.y; ear.forwardZ = direction.current.z
    AudioEngine.update(state, ear)
    const isGrounded = typeof current.grounded === 'boolean' ? current.grounded : null
    const reset = resetVersion.current !== flightEvents.resetVersion
    if (AudioEngine.running && !state.paused && !reset && grounded.current !== null && isGrounded !== null && grounded.current !== isGrounded) {
      if (isGrounded) AudioEngine.landing(state)
      else AudioEngine.takeoff(state)
    }
    grounded.current = AudioEngine.running ? isGrounded : null
    resetVersion.current = flightEvents.resetVersion
  })
  return null
}

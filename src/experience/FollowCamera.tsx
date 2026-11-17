import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { flight, flightEvents } from '../lib/flight'
import { sampleCameraFloor } from '../lib/voxelTerrain'
import { landmarkFloor } from '../lib/landmarkBounds'
import { experienceSnapshot, useExperienceStore } from '../stores/useExperienceStore'
import { cameraInput, resetCameraInput, useCameraInput } from '../hooks/useCameraInput'
import { AIRCRAFT_CAMERAS, framingDistance } from '../lib/aircraftCamera'
import { landmarkCameraPose } from '../lib/landmarkCamera'

export function FollowCamera() {
  const activeStation = useExperienceStore((state) => state.activeStation)
  useCameraInput(activeStation === null)
  const desired = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(flight.x, flight.y, flight.z), [])
  const resetVersion = useRef(-1)
  useFrame(({ camera }, frameDelta) => {
    const store = experienceSnapshot()
    const preset = AIRCRAFT_CAMERAS[store.cameraMode]
    const dt = Math.min(frameDelta, 0.1)
    const reset = resetVersion.current !== flightEvents.resetVersion
    if (reset) resetCameraInput()
    const heading = flight.heading + cameraInput.yaw
    const minimum = framingDistance(preset.fov, camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1.6)
    let distance = preset.distance * cameraInput.zoom
    let height = preset.height * cameraInput.zoom + Math.sin(cameraInput.pitch) * distance
    const actualDistance = Math.hypot(distance, height)
    if (actualDistance < minimum) { const scale = minimum / actualDistance; distance *= scale; height *= scale }
    const cinematicSide = preset.side + (store.cameraMode === 'cine' && !store.settings.reducedMotion ? Math.sin(flight.time * 0.12) * 8 : 0)
    desired.set(flight.x - Math.sin(heading) * distance + Math.cos(heading) * cinematicSide, flight.y + height, flight.z + Math.cos(heading) * distance + Math.sin(heading) * cinematicSide)
    target.set(flight.x, flight.y + 3, flight.z)
    if (store.activeStation) {
      const pose = landmarkCameraPose(store.activeStation, preset.fov, camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1.6)
      desired.copy(pose.position)
      target.copy(pose.target)
    }
    desired.setY(Math.max(desired.y, sampleCameraFloor(desired.x, desired.z, desired.y), landmarkFloor(desired.x, desired.z) + 14))
    if (reset) { resetVersion.current = flightEvents.resetVersion; camera.position.copy(desired); look.copy(target) }
    else { camera.position.lerp(desired, 1 - Math.exp(-(store.settings.reducedMotion ? 9 : 5.5) * dt)); look.lerp(target, 1 - Math.exp(-7 * dt)) }
    camera.position.setY(Math.max(camera.position.y, sampleCameraFloor(camera.position.x, camera.position.z, camera.position.y), landmarkFloor(camera.position.x, camera.position.z) + 14))
    if (!store.activeStation && camera.position.distanceTo(target) < minimum) {
      camera.position.sub(target).normalize().multiplyScalar(minimum).add(target)
      camera.position.setY(Math.max(camera.position.y, sampleCameraFloor(camera.position.x, camera.position.z, camera.position.y), landmarkFloor(camera.position.x, camera.position.z) + 14))
    }
    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - preset.fov) > 0.01) { camera.fov += (preset.fov - camera.fov) * (1 - Math.exp(-4 * dt)); camera.updateProjectionMatrix() }
    camera.lookAt(look)
    if (import.meta.env.DEV) Object.assign(window, { __ANTI_AI_CAMERA__: { distance: camera.position.distanceTo(target), minimum, mode: store.cameraMode, position: camera.position.toArray() } })
  }, -1)
  return null
}

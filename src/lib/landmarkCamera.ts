import { Sphere, Vector3 } from 'three'
import type { StationId } from '../config/stations'
import { getLandmarkBounds } from './landmarkBounds'

export interface LandmarkCameraPose {
  position: Vector3
  target: Vector3
  minimumDistance: number
}

/** FOV is vertical degrees, like THREE.PerspectiveCamera.fov. */
export function landmarkCameraPose(id: StationId, verticalFov: number, aspect: number): LandmarkCameraPose {
  if (!Number.isFinite(verticalFov) || verticalFov <= 0 || verticalFov >= 180 || !Number.isFinite(aspect) || aspect <= 0) throw new RangeError('A valid vertical FOV and positive aspect ratio are required.')
  const sphere = getLandmarkBounds(id).getBoundingSphere(new Sphere())
  const verticalHalfAngle = verticalFov * Math.PI / 360
  const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * aspect)
  const minimumDistance = sphere.radius * 1.15 / Math.sin(Math.min(verticalHalfAngle, horizontalHalfAngle))
  // Retain the existing positive-X/positive-Z views, with the asset's real centre.
  const direction = id === 'about' ? new Vector3(310, 55, 410) : id === 'cube' ? new Vector3(360, 83, 490) : new Vector3(120, 115, 230)
  const target = sphere.center.clone()
  const position = target.clone().add(direction.normalize().multiplyScalar(minimumDistance))
  // Terrain/model floor clamping and transition interpolation belong to FollowCamera.
  return { position, target, minimumDistance }
}

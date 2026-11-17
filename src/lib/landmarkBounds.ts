import { Box3, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { MODEL_CONFIG } from '../config/models'
import { LANDMARK_GEOMETRY } from '../config/landmarkGeometry'
import { getStation } from '../config/stations'
import type { StationId } from '../config/stations'

/** Same scale -> XYZ Euler rotation -> translation as the rendered model wrapper. */
export function landmarkWrapperTransform(id: StationId): Matrix4 {
  const config = MODEL_CONFIG[id]
  const scale = typeof config.scale === 'number' ? new Vector3().setScalar(config.scale) : new Vector3(...config.scale)
  return new Matrix4().compose(new Vector3(...config.position), new Quaternion().setFromEuler(new Euler(...config.rotation)), scale)
}

const boundCache = new Map<StationId, Box3>()

/** Actual world AABB; Box3.applyMatrix4 transforms all eight measured source corners. */
function cachedLandmarkBounds(id: StationId): Box3 {
  const cached = boundCache.get(id)
  if (cached) return cached
  const source = LANDMARK_GEOMETRY[id].sourceBounds
  if (source && MODEL_CONFIG[id].assetPath) {
    const bounds = new Box3(new Vector3(...source.min), new Vector3(...source.max)).applyMatrix4(landmarkWrapperTransform(id))
    boundCache.set(id, bounds)
    return bounds
  }
  const site = getStation(id)
  const [width, depth] = LANDMARK_GEOMETRY[id].sitePadDimensions
  const bounds = new Box3(new Vector3(site.pos[0] - width / 2, site.pos[1], site.pos[2] - depth / 2), new Vector3(site.pos[0] + width / 2, site.pos[1] + 70, site.pos[2] + depth / 2))
  boundCache.set(id, bounds)
  return bounds
}

export function getLandmarkBounds(id: StationId): Box3 {
  return cachedLandmarkBounds(id).clone()
}

/** Conservative flight/camera envelope, including the enlarged wrap and rotations. */
export function landmarkFloor(x: number, z: number): number {
  let floor = -Infinity
  for (const id of ['about', 'cube', 'archive', 'shawarma'] as const) {
    const config = MODEL_CONFIG[id]
    if (!config.assetPath || !config.visible) continue
    const bounds = cachedLandmarkBounds(id)
    if (x >= bounds.min.x - 8 && x <= bounds.max.x + 8 && z >= bounds.min.z - 8 && z <= bounds.max.z + 8) floor = Math.max(floor, bounds.max.y)
  }
  return floor
}

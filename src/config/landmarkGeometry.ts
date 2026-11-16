import type { StationId } from './stations'

type BoundsTuple = readonly [number, number, number]
export interface LandmarkGeometry {
  /** Measured local bounds of the unchanged supplied asset, before its wrapper. */
  sourceBounds: { min: BoundsTuple; max: BoundsTuple } | null
  intendedScale: number
  /** Intended X/Z platform dimensions, including a 20-unit border on each side. */
  sitePadDimensions: readonly [number, number]
}

export const LANDMARK_GEOMETRY: Record<StationId, LandmarkGeometry> = {
  about: { sourceBounds: { min: [-8, 0, -5.215575], max: [8, 11.532514, 5.215575] }, intendedScale: 20, sitePadDimensions: [360, 248.623] },
  cube: { sourceBounds: { min: [-3, -3, -3], max: [3, 3, 3] }, intendedScale: 50, sitePadDimensions: [340, 340] },
  lab: { sourceBounds: null, intendedScale: 1, sitePadDimensions: [172, 172] },
  archive: { sourceBounds: { min: [-47, 0, -46.5], max: [47, 68, 48.5] }, intendedScale: 3.5, sitePadDimensions: [369, 372.5] },
  contact: { sourceBounds: null, intendedScale: 1, sitePadDimensions: [172, 172] },
  shawarma: { sourceBounds: { min: [-1.246448, 0, -1.270383], max: [1.246448, 8, 1.270383] }, intendedScale: 7.5, sitePadDimensions: [58.69672, 59.055745] },
}

export const LANDMARK_PAD_MARGIN = 20
/** Keeps voxel sampling and the airframe's immediate approach outside the platform. */
export const LANDMARK_GRADING_MARGIN = 90

export function getLandmarkPadDimensions(id: StationId, scale = LANDMARK_GEOMETRY[id].intendedScale): [number, number] {
  const geometry = LANDMARK_GEOMETRY[id]
  if (!geometry.sourceBounds) return [...geometry.sitePadDimensions]
  const { min, max } = geometry.sourceBounds
  return [(max[0] - min[0]) * scale + LANDMARK_PAD_MARGIN * 2, (max[2] - min[2]) * scale + LANDMARK_PAD_MARGIN * 2]
}

/** Deliberately independent of MODEL_CONFIG: terrain also runs in a voxel worker. */
export function getLandmarkPadRadius(id: StationId, scale = LANDMARK_GEOMETRY[id].intendedScale): number {
  const [width, depth] = getLandmarkPadDimensions(id, scale)
  return Math.hypot(width, depth) / 2 + LANDMARK_GRADING_MARGIN
}

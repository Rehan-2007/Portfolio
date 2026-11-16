import { AIRCRAFT_RADIUS, AIRCRAFT_SIZE } from '../config/aircraft'

/** Fit a conservative aircraft sphere in the smaller horizontal/vertical FOV. */
export function framingDistance(verticalFovDegrees: number, aspect: number): number {
  const halfV = verticalFovDegrees * Math.PI / 360
  const halfH = Math.atan(Math.tan(halfV) * Math.max(0.25, aspect))
  return AIRCRAFT_RADIUS / Math.sin(Math.min(halfV, halfH)) * 1.12
}
export const AIRCRAFT_CAMERAS = {
  follow: { distance: AIRCRAFT_SIZE.span * 1.65, height: AIRCRAFT_SIZE.span * 0.55, side: 0, fov: 58 },
  cine: { distance: AIRCRAFT_SIZE.span * 2.05, height: AIRCRAFT_SIZE.span * 0.65, side: AIRCRAFT_SIZE.span * 0.45, fov: 54 },
  station: { distance: AIRCRAFT_SIZE.span * 0.75, height: AIRCRAFT_SIZE.span * 1.85, side: 0, fov: 62 },
} as const

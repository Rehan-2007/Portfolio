import { AIRCRAFT_SIZE } from '../config/aircraft'
import { sampleObstacleHeight } from './voxelTerrain'
import { landmarkFloor } from './landmarkBounds'

/** A conservative five-point airframe footprint, including bank and pitch clearance. */
export function aircraftFloor(x: number, z: number, heading: number, altitude: number, roll = 0, pitch = 0): number {
  const fx = Math.sin(heading)
  const fz = -Math.cos(heading)
  const rx = Math.cos(heading)
  const rz = Math.sin(heading)
  const halfSpan = AIRCRAFT_SIZE.span / 2
  const halfChord = AIRCRAFT_SIZE.chord / 2
  const points = [
    [x, z], [x + rx * halfSpan, z + rz * halfSpan], [x - rx * halfSpan, z - rz * halfSpan],
    [x + fx * halfChord, z + fz * halfChord], [x - fx * halfChord, z - fz * halfChord],
  ]
  let floor = -Infinity
  for (const [px, pz] of points) floor = Math.max(floor, sampleObstacleHeight(px, pz, altitude), landmarkFloor(px, pz))
  return floor + AIRCRAFT_SIZE.height / 2 + Math.abs(Math.sin(roll)) * halfSpan + Math.abs(Math.sin(pitch)) * halfChord + 14
}

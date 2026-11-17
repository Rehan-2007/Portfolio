import { Vector3 } from 'three'
import { getStation } from '../config/stations'
import type { StationId } from '../config/stations'
import { flight, flightEvents } from './flight'
import { sampleFlightFloor } from './voxelTerrain'
import { aircraftFloor } from './aircraftClearance'
import { ACTIVE_AIRCRAFT, AIRCRAFT_SIZE } from '../config/aircraft'
import { MODEL_CONFIG } from '../config/models'
import { getLandmarkBounds, landmarkWrapperTransform } from './landmarkBounds'

export function stationProximity(id: StationId, x: number, y: number, z: number): boolean {
  const site = getStation(id)
  const model = MODEL_CONFIG[id]
  if (!model.interaction.enabled) return false
  const point = model.assetPath ? new Vector3(...model.interaction.point).applyMatrix4(landmarkWrapperTransform(id)) : new Vector3(...site.pos)
  const bounds = getLandmarkBounds(id)
  const size = bounds.getSize(new Vector3())
  const verticalReach = Math.max(210, bounds.max.y - point.y + AIRCRAFT_SIZE.height / 2 + 44)
  const horizontalReach = Math.max(model.interaction.radius, Math.hypot(size.x, size.z) / 2 + AIRCRAFT_SIZE.span / 2 + 90)
  return Math.hypot(x - point.x, z - point.z) <= horizontalReach && Math.abs(y - point.y) < verticalReach
}

export function teleportAircraft(id: StationId): void {
  const site = getStation(id)
  const bounds = getLandmarkBounds(id)
  const center = bounds.getCenter(new Vector3())
  const size = bounds.getSize(new Vector3())
  const distance = Math.hypot(center.x, center.z) || 1
  const dx = center.x / distance
  const dz = center.z / distance
  // Project the whole landmark on the approach direction; chord is the airframe's
  // extent along its heading. Wingtip terrain/landmark clearance is sampled below.
  const approach = size.x / 2 * Math.abs(dx) + size.z / 2 * Math.abs(dz) + AIRCRAFT_SIZE.chord / 2 + 80
  const x = center.x - dx * approach
  const z = center.z - dz * approach
  const heading = Math.atan2(center.x - x, -(center.z - z))
  Object.assign(flight, {
    x, z, heading,
    y: Math.max(site.pos[1] + 130, sampleFlightFloor(x, z, heading) + 12, aircraftFloor(x, z, heading, Infinity) + 30),
    speed: 160, throttle: 160 / ACTIVE_AIRCRAFT.flight.maxSpeed, boosting: false,
    vy: 0, pitch: 0, roll: 0, turnRate: 0,
  })
  flightEvents.resetVersion += 1
}

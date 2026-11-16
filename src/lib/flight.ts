import type { FlightMode } from '../stores/useExperienceStore'
import { MAX_ALTITUDE, MIN_ALTITUDE, SPAWN, WORLD_BOUND } from '../config/stations'
import { ACTIVE_AIRCRAFT, BOOST } from '../config/aircraft'
import { clamp, damp, wrapAngle } from './math'
import { aircraftFloor } from './aircraftClearance'

export interface FlightInput {
  throttle: number
  turn: number
  vertical: number
  boost?: boolean
}
export interface FlightState {
  x: number; y: number; z: number
  heading: number; turnRate: number; roll: number; pitch: number
  speed: number; vy: number; throttle: number
  boostEnergy: number; boostCooldown: number; boosting: boolean
  grounded: boolean; bobPhase: number; mode: FlightMode; frozen: boolean; time: number
}

const profile = ACTIVE_AIRCRAFT.flight
const saneAxis = (value: number) => Number.isFinite(value) ? clamp(value, -1, 1) : 0
export function createFlightState(): FlightState {
  return {
    x: SPAWN.x, y: SPAWN.y, z: SPAWN.z, heading: SPAWN.heading,
    turnRate: 0, roll: 0, pitch: 0, speed: SPAWN.speed, vy: 0,
    throttle: SPAWN.speed / profile.maxSpeed,
    boostEnergy: 1, boostCooldown: 0, boosting: false, grounded: false,
    bobPhase: 0, mode: 'flight', frozen: false, time: 0,
  }
}
export const flight = createFlightState()
export const flightEvents = { resetVersion: 0 }
export function resetFlight(): void { Object.assign(flight, createFlightState()); flightEvents.resetVersion++ }
export function forwardOf(heading: number): [number, number] { return [Math.sin(heading), -Math.cos(heading)] }

/** One controller with bounded 120 Hz substeps at any display frame rate. */
export function updateFlight(input: FlightInput, dt: number, reducedMotion: boolean): void {
  if (!Number.isFinite(dt) || dt <= 0 || flight.frozen) return
  const safe = { throttle: saneAxis(input.throttle), turn: saneAxis(input.turn), vertical: saneAxis(input.vertical), boost: input.boost === true }
  const count = Math.ceil(Math.min(dt, 0.1) * 120)
  const step = Math.min(dt, 0.1) / count
  for (let i = 0; i < count; i++) advanceFlight(safe, step, reducedMotion)
}

function advanceFlight(input: FlightInput, dt: number, reducedMotion: boolean): void {
  flight.time += dt
  flight.throttle = clamp(flight.throttle + input.throttle * profile.throttleRate * dt, 0, 1)
  flight.boostCooldown = Math.max(0, flight.boostCooldown - dt)
  const mayStart = flight.boostEnergy >= BOOST.restartEnergy && flight.boostCooldown === 0
  flight.boosting = !!input.boost && flight.mode === 'flight' && flight.throttle > 0.05 && (flight.boosting ? flight.boostEnergy > 0 : mayStart)
  if (flight.boosting) {
    flight.boostEnergy = Math.max(0, flight.boostEnergy - BOOST.drain * dt)
    if (flight.boostEnergy === 0) { flight.boosting = false; flight.boostCooldown = BOOST.lockoutSeconds }
  } else if (!input.boost && flight.boostCooldown === 0) {
    flight.boostEnergy = Math.min(1, flight.boostEnergy + BOOST.recharge * dt)
  }
  const maximum = flight.boosting ? profile.boostSpeed : profile.maxSpeed
  const targetSpeed = flight.mode === 'hover' ? 0 : flight.throttle * maximum
  const rate = targetSpeed > flight.speed ? profile.acceleration * (flight.boosting ? 1.5 : 1) : profile.braking
  const response = damp(flight.speed, targetSpeed, targetSpeed > flight.speed ? 2.3 : 3.1, dt) - flight.speed
  flight.speed = clamp(flight.speed + clamp(response, -rate * dt, rate * dt), 0, profile.boostSpeed)

  const authority = flight.mode === 'hover' ? 0.45 : 0.45 + 0.55 * Math.min(flight.speed / 300, 1)
  flight.turnRate = damp(flight.turnRate, input.turn * profile.turnRate * authority, 5.8, dt)
  flight.heading = wrapAngle(flight.heading + flight.turnRate * dt)
  flight.roll = damp(flight.roll, clamp(-flight.turnRate / profile.turnRate * 0.76, -0.76, 0.76), 4.4, dt)
  flight.vy = damp(flight.vy, input.vertical * profile.climbRate, 4.5, dt)
  flight.pitch = damp(flight.pitch, clamp(flight.vy / profile.climbRate, -1, 1) * 0.26, 4.5, dt)
  flight.bobPhase += dt * 0.7
  const bob = reducedMotion ? 0 : Math.sin(flight.bobPhase * Math.PI * 2) * 0.3
  const [fx, fz] = forwardOf(flight.heading)
  flight.x += fx * flight.speed * dt
  flight.z += fz * flight.speed * dt
  flight.y += (flight.vy + bob) * dt

  // Sample the current footprint and a swept, speed-dependent corridor ahead.
  let aheadFloor = -Infinity
  const lookAhead = Math.max(80, flight.speed * 0.9)
  for (const fraction of [0.25, 0.5, 0.75, 1]) {
    aheadFloor = Math.max(aheadFloor, aircraftFloor(flight.x + fx * lookAhead * fraction, flight.z + fz * lookAhead * fraction, flight.heading, flight.y, flight.roll, flight.pitch))
  }
  if (aheadFloor > flight.y) flight.y = damp(flight.y, aheadFloor + 12, 2.5, dt)
  const floor = Math.max(MIN_ALTITUDE, aircraftFloor(flight.x, flight.z, flight.heading, flight.y, flight.roll, flight.pitch))
  flight.grounded = flight.y <= floor + 0.7
  flight.y = clamp(flight.y, floor, MAX_ALTITUDE)
  if (flight.grounded) flight.vy = Math.max(0, flight.vy)
  if (flight.y >= MAX_ALTITUDE) flight.vy = Math.min(0, flight.vy)
  applyBounds(dt)
}

function applyBounds(dt: number): void {
  const edge = Math.max(Math.abs(flight.x), Math.abs(flight.z))
  if (edge > WORLD_BOUND - 450) {
    const towardCenter = Math.atan2(-flight.x, flight.z)
    flight.heading += wrapAngle(towardCenter - flight.heading) * (1 - Math.exp(-1.5 * dt))
  }
  flight.x = clamp(flight.x, -WORLD_BOUND, WORLD_BOUND)
  flight.z = clamp(flight.z, -WORLD_BOUND, WORLD_BOUND)
}
export function compassDeg(heading: number): number { return (((heading * 180) / Math.PI) % 360 + 360) % 360 }

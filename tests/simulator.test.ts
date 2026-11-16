import assert from 'node:assert/strict'
import test from 'node:test'
import { Matrix4, Vector3 } from 'three'
import { ACTIVE_AIRCRAFT, AIRCRAFT_SCALE, AIRCRAFT_SIZE, AIRCRAFT, METERS_PER_WORLD_UNIT, altitudeMeters, speedKmh, uniformAircraftScale } from '../src/config/aircraft'
import { MODEL_CONFIG } from '../src/config/models'
import { framingDistance } from '../src/lib/aircraftCamera'
import { aircraftFloor } from '../src/lib/aircraftClearance'
import { flight, resetFlight, updateFlight, forwardOf } from '../src/lib/flight'
import { SPAWN } from '../src/config/stations'
import { createSimulationClock } from '../src/lib/simulationClock'

test('simulation clock ignores non-finite and backwards timestamps', () => {
  const clock = createSimulationClock(NaN)
  assert.equal(clock.tick(1000), 0)
  assert.equal(clock.tick(NaN), 0)
  assert.equal(clock.tick(900), 0)
  assert.ok(Math.abs(clock.tick(1020) - 0.02) < 1e-9)
})

test('B-2 uses a uniform four-times measured scale and actual source yaw correction', () => {
  assert.equal(AIRCRAFT_SCALE, 4)
  assert.equal(AIRCRAFT_SIZE.span, 224)
  assert.equal(MODEL_CONFIG.aircraft.scale, 4)
  assert.equal(MODEL_CONFIG.aircraft.rotation[1], Math.PI)
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const nose = new Vector3(...ACTIVE_AIRCRAFT.sourceForward).applyMatrix4(new Matrix4().makeRotationY(Math.PI - heading))
    const [x, z] = forwardOf(heading)
    assert.ok(Math.abs(nose.x - x) < 1e-9)
    assert.ok(Math.abs(nose.z - z) < 1e-9)
  }
})

test('reference-only aircraft retain relative sizes and make no invented model requests', () => {
  for (const id of ['f16', 'f22', 'c130'] as const) {
    assert.equal(AIRCRAFT[id].assetPath, null)
    const size = uniformAircraftScale(id, 1)
    assert.ok(size > 0 && size < AIRCRAFT_SIZE.span)
  }
  assert.ok(Math.abs(speedKmh(100) - 100 * METERS_PER_WORLD_UNIT * 3.6) < 1e-9)
  assert.equal(altitudeMeters(224), 52.4)
})

test('all camera fits cover portrait and desktop smaller field of view', () => {
  for (const aspect of [360 / 800, 4 / 3, 16 / 9]) {
    const distance = framingDistance(58, aspect)
    assert.ok(distance > AIRCRAFT_SIZE.span / 2)
    const smaller = Math.min(58 * Math.PI / 360, Math.atan(Math.tan(58 * Math.PI / 360) * aspect))
    assert.ok(distance * Math.sin(smaller) >= Math.hypot(AIRCRAFT_SIZE.span, AIRCRAFT_SIZE.height, AIRCRAFT_SIZE.chord) / 2)
  }
})

test('larger spawn clears terrain and invalid axes cannot poison the simulation', () => {
  assert.ok(SPAWN.y > aircraftFloor(SPAWN.x, SPAWN.z, 0, SPAWN.y))
  resetFlight()
  updateFlight({ throttle: NaN, turn: Infinity, vertical: -Infinity }, 0.1, true)
  assert.ok([flight.x, flight.y, flight.z, flight.heading, flight.speed].every(Number.isFinite))
})

test('boost accelerates beyond cruise, depletes, locks out, and recharges only after release', () => {
  resetFlight(); flight.y = 1300; flight.throttle = 1
  for (let i = 0; i < 120 * 5; i++) updateFlight({ throttle: 0, turn: 0, vertical: 0, boost: true }, 1 / 120, true)
  assert.ok(flight.speed > ACTIVE_AIRCRAFT.flight.maxSpeed)
  assert.ok(flight.boostEnergy < 0.001)
  for (let i = 0; i < 120; i++) updateFlight({ throttle: 0, turn: 0, vertical: 0, boost: true }, 1 / 120, true)
  assert.equal(flight.boosting, false)
  assert.ok(flight.boostCooldown > 0)
  for (let i = 0; i < 120 * 6; i++) updateFlight({ throttle: 0, turn: 0, vertical: 0, boost: false }, 1 / 120, true)
  assert.ok(flight.boostEnergy > 0.25)
})

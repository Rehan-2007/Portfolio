import assert from 'node:assert/strict'
import test from 'node:test'
import { createSimulationClock } from '../src/lib/simulationClock'
import { flight, resetFlight, updateFlight, compassDeg } from '../src/lib/flight'
import { stationProximity, teleportAircraft } from '../src/lib/flightNavigation'
import { STATIONS, SPAWN } from '../src/config/stations'
import { sampleFlightFloor } from '../src/lib/voxelTerrain'

test('frame clock converts milliseconds to seconds and limits background gaps', () => {
  const clock = createSimulationClock()
  assert.equal(clock.tick(1000), 0)
  assert.ok(Math.abs(clock.tick(1016.6666667) - 1 / 60) < 1e-8)
  assert.ok(clock.tick(5016) < 0.117)
  clock.suspend()
  const before = clock.tick(100000)
  assert.ok(before < 0.117)
})

function simulate(hz: number) {
  resetFlight()
  flight.y = 1100
  for (let i = 0; i < hz * 2; i++) updateFlight({ throttle: 1, turn: 0.6, vertical: 0.3 }, 1 / hz, true)
  return { ...flight }
}

test('flight result is stable at 30, 60 and 120 Hz', () => {
  const reference = simulate(120)
  for (const hz of [30, 60]) {
    const actual = simulate(hz)
    for (const key of ['x', 'y', 'z', 'speed', 'heading', 'pitch', 'roll'] as const) {
      assert.ok(Math.abs(reference[key] - actual[key]) < 0.03, `${hz} Hz: ${key}`)
    }
  }
  assert.ok(reference.x > 0 && reference.heading > 0 && reference.roll < 0)
  assert.ok(reference.y > 1100)
})

test('pause holds state, reset is exact, modes and braking work', () => {
  resetFlight()
  flight.frozen = true
  const before = { ...flight }
  updateFlight({ throttle: 1, turn: 1, vertical: 1 }, 0.1, true)
  assert.deepEqual(flight, before)
  resetFlight()
  assert.equal(flight.x, SPAWN.x)
  assert.equal(flight.y, SPAWN.y)
  assert.equal(flight.z, SPAWN.z)
  const speed = flight.speed
  updateFlight({ throttle: -1, turn: 0, vertical: 0 }, 0.1, true)
  assert.ok(flight.speed < speed)
  flight.mode = 'hover'
  updateFlight({ throttle: 1, turn: 0, vertical: 0 }, 0.1, true)
  assert.ok(flight.speed < speed)
  assert.ok(Math.abs(compassDeg(-Math.PI * 8 - Math.PI / 2) - 270) < 1e-9)
})

test('giant landmark interactions remain reachable above their flight-clearance envelopes', () => {
  const cube = STATIONS.find((site) => site.id === 'cube')!
  assert.ok(stationProximity('cube', cube.pos[0], 325, cube.pos[2]))
  assert.ok(stationProximity('cube', cube.pos[0] - 190, 72, cube.pos[2]))
  assert.ok(!stationProximity('cube', cube.pos[0], 1000, cube.pos[2]))
  const laptop = STATIONS.find((site) => site.id === 'about')!
  assert.ok(stationProximity('about', laptop.pos[0], 260, laptop.pos[2]))
})

test('all destination teleports clear their terrain and reset attitude', () => {
  for (const site of STATIONS) {
    teleportAircraft(site.id)
    assert.ok(flight.y >= sampleFlightFloor(flight.x, flight.z, flight.heading, flight.y))
    assert.equal(flight.roll, 0)
    assert.equal(flight.vy, 0)
  }
})

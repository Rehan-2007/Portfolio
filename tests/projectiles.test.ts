import assert from 'node:assert/strict'
import test from 'node:test'
import { createProjectilePool, getMuzzleOrigins, transformForward, PROJECTILE_CAPACITY, EFFECTS_CONFIG } from '../src/lib/projectiles'

const aircraft = () => ({ x: 0, y: 1000, z: 0, heading: 0, pitch: 0, roll: 0, speed: 500, frozen: false, time: 0 })

test('dual wing origins and forward direction track yaw pitch and bank together', () => {
  const state = aircraft()
  state.heading = Math.PI / 2
  state.pitch = 0.2
  state.roll = -0.4
  const points = getMuzzleOrigins(state)
  const direction = transformForward(state)
  assert.ok(points[0].y > points[1].y)
  assert.ok(direction.x > 0.95)
  assert.ok(direction.y > 0)
  assert.ok(Math.abs(Math.hypot(direction.x, direction.y, direction.z) - 1) < 1e-9)
})

test('fires synchronized pairs, consumes two charges and stops on release', () => {
  const pool = createProjectilePool({ sampleFloor: () => -1000 })
  const state = aircraft()
  pool.setEnabled(true)
  pool.update(1 / 60, { fire: true }, state)
  assert.equal(pool.activeProjectiles, 2)
  assert.equal(pool.state.ammo, 118)
  assert.equal(pool.state.shotsFired, 1)
  for (let i = 0; i < 60; i++) pool.update(1 / 60, { fire: false }, state)
  assert.equal(pool.state.shotsFired, 1)
  assert.equal(pool.state.firing, false)
})

test('pool capacity and object identities remain fixed through repeated firing/reloads', () => {
  const pool = createProjectilePool({ sampleFloor: () => -1000 })
  const state = aircraft()
  const identities = [...pool.projectiles]
  pool.setEnabled(true)
  for (let i = 0; i < 1200; i++) {
    if (!pool.state.ammo) pool.startReload()
    pool.update(1 / 60, { fire: true }, state)
    assert.ok(pool.activeProjectiles <= PROJECTILE_CAPACITY)
  }
  assert.equal(pool.projectiles.length, PROJECTILE_CAPACITY)
  pool.projectiles.forEach((item, index) => assert.equal(item, identities[index]))
})

test('ammo reload and timers freeze while paused, disabled state clears visuals', () => {
  const pool = createProjectilePool({ sampleFloor: () => -1000 })
  const state = aircraft()
  pool.setEnabled(true)
  pool.update(0.1, { fire: true }, state)
  assert.ok(pool.startReload())
  const remaining = pool.state.reloadRemaining
  state.frozen = true
  pool.update(0.1, { fire: true }, state)
  assert.equal(pool.state.reloadRemaining, remaining)
  state.frozen = false
  for (let i = 0; i < 26; i++) pool.update(0.1, { fire: false }, state)
  assert.equal(pool.state.ammo, EFFECTS_CONFIG.ammo)
  assert.equal(pool.state.reloadRemaining, 0)
  pool.setEnabled(false)
  assert.equal(pool.activeProjectiles, 0)
  assert.equal(pool.activeImpacts, 0)
})

test('contacts produce bounded decorative impacts, then recycle and reset completely', () => {
  const pool = createProjectilePool({ sampleFloor: () => 1000 })
  pool.setEnabled(true)
  pool.update(0.02, { fire: true }, aircraft())
  assert.equal(pool.state.impactCount, 2)
  assert.equal(pool.activeImpacts, 2)
  assert.equal(pool.activeProjectiles, 0)
  for (let i = 0; i < 5; i++) pool.update(0.1, { fire: false }, aircraft())
  assert.equal(pool.activeImpacts, 0)
  pool.reset()
  assert.equal(pool.state.shotsFired, 0)
  assert.equal(pool.state.enabled, false)
  assert.equal(pool.state.ammo, 120)
})

test('paired firing count is display-rate independent', () => {
  const counts = [30, 60, 120].map((hz) => {
    const pool = createProjectilePool({ sampleFloor: () => -1000 })
    pool.setEnabled(true)
    for (let i = 0; i < hz * 2; i++) pool.update(1 / hz, { fire: true }, aircraft())
    return pool.state.shotsFired
  })
  assert.equal(counts[0], counts[1])
  assert.equal(counts[1], counts[2])
})

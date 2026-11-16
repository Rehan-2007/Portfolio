import { AIRCRAFT_SIZE } from '../config/aircraft'
import { landmarkFloor } from './landmarkBounds'
import { sampleTerrainHeight } from './voxelTerrain'

/** Fictional, decorative light projectiles only. No targets, damage or physics bodies. */
export const PROJECTILE_CAPACITY = 192
export const IMPACT_CAPACITY = 32
export const EFFECTS_CONFIG = {
  ammo: 120, // Individual lights: one paired shot consumes two charges.
  shotInterval: 0.12,
  reloadSeconds: 2.5,
  projectileLife: 1.2,
  projectileSpeed: 2600,
  impactLife: 0.36,
  muzzleLife: 0.045,
  maxDelta: 0.1,
  maxStep: 1 / 120,
} as const

export interface EffectsVector { x: number; y: number; z: number }
export interface EffectsFlight {
  x: number; y: number; z: number
  /** Clockwise heading, nose-up pitch, negative roll for a right bank. */
  heading: number; pitch: number; roll: number
  speed: number; frozen: boolean; time: number
  boosting?: boolean
}
export interface EffectsInput { fire: boolean; boost?: boolean }
/** Optional bridge for callers without a shared simulator input. No listeners are installed here. */
export const effectsInput: EffectsInput = { fire: false, boost: false }
export interface EffectState {
  enabled: boolean
  firing: boolean
  ammo: number
  reloadRemaining: number
  cooldown: number
  /** Counts paired emissions, not individual lights. */
  shotsFired: number
  /** Counts decorative floor contacts only. */
  impactCount: number
}
export interface Projectile extends EffectsVector {
  active: boolean
  vx: number; vy: number; vz: number
  age: number
}
export interface Impact extends EffectsVector { active: boolean; age: number }
export interface FireEvent {
  shot: number; ammo: number
  /** Borrowed reusable vectors: copy them if retaining an event. */
  origins: readonly [EffectsVector, EffectsVector]
  direction: EffectsVector
}
export interface ImpactEvent extends EffectsVector { count: number }
export interface EffectCallbacks {
  onFire?: (event: FireEvent) => void
  onImpact?: (event: ImpactEvent) => void
}
export interface EffectsUpdateOptions extends EffectCallbacks { ready?: boolean }

const vector = (): EffectsVector => ({ x: 0, y: 0, z: 0 })
const initialState = (): EffectState => ({
  enabled: false, firing: false, ammo: EFFECTS_CONFIG.ammo,
  reloadRemaining: 0, cooldown: 0, shotsFired: 0, impactCount: 0,
})
const LOCAL_MUZZLES: readonly [EffectsVector, EffectsVector] = [
  { x: -0.32 * AIRCRAFT_SIZE.span, y: 0, z: -0.15 * AIRCRAFT_SIZE.chord },
  { x: 0.32 * AIRCRAFT_SIZE.span, y: 0, z: -0.15 * AIRCRAFT_SIZE.chord },
]
const LOCAL_FORWARD: EffectsVector = { x: 0, y: 0, z: -1 }

/** Ry(-heading) * Rx(pitch) * Rz(roll), matching the nested Three groups.
 * These coordinates are already logical aircraft space (-Z nose); do not apply
 * the source model's corrective PI yaw a second time.
 */
export function transformEffectsVector(
  local: EffectsVector,
  attitude: Pick<EffectsFlight, 'heading' | 'pitch' | 'roll'>,
  out: EffectsVector = vector(),
): EffectsVector {
  const cr = Math.cos(attitude.roll), sr = Math.sin(attitude.roll)
  const cp = Math.cos(attitude.pitch), sp = Math.sin(attitude.pitch)
  const ch = Math.cos(attitude.heading), sh = Math.sin(attitude.heading)
  const rx = cr * local.x - sr * local.y
  const ry = sr * local.x + cr * local.y
  const py = cp * ry - sp * local.z
  const pz = sp * ry + cp * local.z
  out.x = ch * rx - sh * pz
  out.y = py
  out.z = sh * rx + ch * pz
  return out
}
export function transformForward(
  attitude: Pick<EffectsFlight, 'heading' | 'pitch' | 'roll'>,
  out: EffectsVector = vector(),
): EffectsVector {
  return transformEffectsVector(LOCAL_FORWARD, attitude, out)
}
export function getMuzzleOrigins(
  aircraft: EffectsFlight,
  out: [EffectsVector, EffectsVector] = [vector(), vector()],
): [EffectsVector, EffectsVector] {
  for (let wing = 0; wing < 2; wing++) {
    transformEffectsVector(LOCAL_MUZZLES[wing], aircraft, out[wing])
    out[wing].x += aircraft.x
    out[wing].y += aircraft.y
    out[wing].z += aircraft.z
  }
  return out
}

/** Conservative height-field contact, not a mesh raycast or a target hit test. */
export function sampleEffectsFloor(x: number, z: number): number {
  return Math.max(sampleTerrainHeight(x, z), landmarkFloor(x, z))
}

/** Fixed storage; create independent pools for deterministic tests. All time is simulation seconds. */
export function createProjectilePool(options: { sampleFloor?: (x: number, z: number) => number } = {}) {
  const state = initialState()
  const projectiles: Projectile[] = Array.from({ length: PROJECTILE_CAPACITY }, () => ({
    x: 0, y: 0, z: 0, active: false, vx: 0, vy: 0, vz: 0, age: 0,
  }))
  const impacts: Impact[] = Array.from({ length: IMPACT_CAPACITY }, () => ({
    x: 0, y: 0, z: 0, active: false, age: 0,
  }))
  const muzzles: [EffectsVector, EffectsVector] = [vector(), vector()]
  const forward = vector()
  const sampleFloor = options.sampleFloor ?? sampleEffectsFloor
  const fireEvent: FireEvent = { shot: 0, ammo: state.ammo, origins: muzzles, direction: forward }
  const impactEvent: ImpactEvent = { x: 0, y: 0, z: 0, count: 0 }
  let projectileCursor = 0
  let impactCursor = 0
  let muzzleRemaining = 0

  function clearVisuals(): void {
    for (const p of projectiles) p.active = false
    for (const p of impacts) p.active = false
    muzzleRemaining = 0
  }
  function setEnabled(enabled: boolean): void {
    state.enabled = enabled
    if (!enabled) { state.firing = false; clearVisuals() }
  }
  function startReload(): boolean {
    if (!state.enabled || state.reloadRemaining > 0 || state.ammo >= EFFECTS_CONFIG.ammo) return false
    state.reloadRemaining = EFFECTS_CONFIG.reloadSeconds
    state.firing = false
    muzzleRemaining = 0
    return true
  }
  function reset(): void {
    Object.assign(state, initialState())
    for (const p of projectiles) Object.assign(p, { x: 0, y: 0, z: 0, active: false, vx: 0, vy: 0, vz: 0, age: 0 })
    for (const p of impacts) Object.assign(p, { x: 0, y: 0, z: 0, active: false, age: 0 })
    for (const p of muzzles) Object.assign(p, vector())
    Object.assign(forward, vector())
    projectileCursor = 0
    impactCursor = 0
    muzzleRemaining = 0
  }
  function emitPair(callbacks: EffectCallbacks): void {
    let first = -1, second = -1
    for (let offset = 0; offset < PROJECTILE_CAPACITY; offset++) {
      const index = (projectileCursor + offset) % PROJECTILE_CAPACITY
      if (!projectiles[index].active) {
        if (first < 0) first = index
        else { second = index; break }
      }
    }
    // Never overwrite a live light, emit half a pair, or charge for a dropped pair.
    state.cooldown = EFFECTS_CONFIG.shotInterval
    if (second < 0) return
    const speed = EFFECTS_CONFIG.projectileSpeed + Math.max(0, aircraftSpeed)
    for (let wing = 0; wing < 2; wing++) {
      const p = projectiles[wing === 0 ? first : second]
      const origin = muzzles[wing]
      p.x = origin.x; p.y = origin.y; p.z = origin.z
      p.vx = forward.x * speed; p.vy = forward.y * speed; p.vz = forward.z * speed
      p.age = 0; p.active = true
    }
    projectileCursor = (second + 1) % PROJECTILE_CAPACITY
    state.ammo -= 2
    state.shotsFired++
    muzzleRemaining = EFFECTS_CONFIG.muzzleLife
    fireEvent.shot = state.shotsFired
    fireEvent.ammo = state.ammo
    callbacks.onFire?.(fireEvent)
  }
  let aircraftSpeed = 0

  function contact(x: number, y: number, z: number, callbacks: EffectCallbacks): void {
    // A ring buffer deliberately replaces the oldest puff when all 32 are occupied.
    const impact = impacts[impactCursor]
    impactCursor = (impactCursor + 1) % IMPACT_CAPACITY
    impact.x = x; impact.y = y; impact.z = z; impact.age = 0; impact.active = true
    state.impactCount++
    impactEvent.x = x; impactEvent.y = y; impactEvent.z = z; impactEvent.count = state.impactCount
    callbacks.onImpact?.(impactEvent)
  }
  function advanceVisuals(dt: number, callbacks: EffectCallbacks): void {
    for (const impact of impacts) {
      if (!impact.active) continue
      impact.age += dt
      if (impact.age + 1e-9 >= EFFECTS_CONFIG.impactLife) impact.active = false
    }
    for (const p of projectiles) {
      if (!p.active) continue
      const lifeStep = Math.min(dt, Math.max(0, EFFECTS_CONFIG.projectileLife - p.age))
      const dx = p.vx * lifeStep, dy = p.vy * lifeStep, dz = p.vz * lifeStep
      // Sample along the short segment at <=14-unit terrain-cell spacing to avoid
      // skipping a raised floor at high speed. No scene objects are queried.
      const samples = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 14))
      for (let index = 0; index <= samples; index++) {
        const fraction = index / samples
        const x = p.x + dx * fraction, y = p.y + dy * fraction, z = p.z + dz * fraction
        const floor = sampleFloor(x, z)
        if (Number.isFinite(floor) && y <= floor) {
          contact(x, floor + 0.5, z, callbacks)
          p.active = false
          break
        }
      }
      if (!p.active) continue
      p.x += dx; p.y += dy; p.z += dz; p.age += lifeStep
      if (p.age + 1e-9 >= EFFECTS_CONFIG.projectileLife) p.active = false
    }
    muzzleRemaining = Math.max(0, muzzleRemaining - dt)
  }
  function update(dt: number, input: EffectsInput, aircraft: EffectsFlight, callbacks: EffectsUpdateOptions = {}): void {
    state.firing = false
    if (!state.enabled || aircraft.frozen || callbacks.ready === false || !Number.isFinite(dt) || dt <= 0) return
    if (![aircraft.x, aircraft.y, aircraft.z, aircraft.heading, aircraft.pitch, aircraft.roll, aircraft.speed].every(Number.isFinite)) return
    getMuzzleOrigins(aircraft, muzzles)
    transformForward(aircraft, forward)
    aircraftSpeed = aircraft.speed
    let remaining = Math.min(dt, EFFECTS_CONFIG.maxDelta)
    while (remaining > 1e-9) {
      state.firing = input.fire && state.reloadRemaining <= 1e-9 && state.ammo >= 2
      if (state.firing && state.cooldown <= 1e-9) emitPair(callbacks)
      const step = Math.min(
        remaining, EFFECTS_CONFIG.maxStep,
        state.cooldown > 1e-9 ? state.cooldown : Infinity,
        state.reloadRemaining > 1e-9 ? state.reloadRemaining : Infinity,
      )
      advanceVisuals(step, callbacks)
      state.cooldown = Math.max(0, state.cooldown - step)
      if (state.reloadRemaining > 0) {
        state.reloadRemaining = Math.max(0, state.reloadRemaining - step)
        if (state.reloadRemaining <= 1e-9) { state.reloadRemaining = 0; state.ammo = EFFECTS_CONFIG.ammo }
      }
      remaining -= step
    }
    state.firing = input.fire && state.reloadRemaining === 0 && state.ammo >= 2
  }
  return {
    state, projectiles, impacts, muzzles, forward,
    get muzzleRemaining() { return muzzleRemaining },
    get activeProjectiles() { return projectiles.reduce((count, p) => count + Number(p.active), 0) },
    get activeImpacts() { return impacts.reduce((count, p) => count + Number(p.active), 0) },
    setEnabled, startReload, reset, update,
  }
}
export type ProjectilePool = ReturnType<typeof createProjectilePool>
export const projectilePool = createProjectilePool()
/** Mutable frame-sampled counters. Only enabled is mirrored reactively by useEffects. */
export const effectState = projectilePool.state

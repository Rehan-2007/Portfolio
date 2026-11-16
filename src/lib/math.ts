/** Small math helpers shared across the experience. */

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Frame-rate independent exponential damping (Freya Holmér style). */
export const damp = (
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number => lerp(current, target, 1 - Math.exp(-lambda * dt))

/** Wrap angle to [-PI, PI]. */
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

/** Damped approach for angles, taking the short way around. */
export function dampAngle(
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number {
  return current + wrapAngle(target - current) * (1 - Math.exp(-lambda * dt))
}

/** Deterministic pseudo-random from a seed (for stable procedural worlds). */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

export { lerp as lerpNumber }

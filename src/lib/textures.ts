/**
 * Procedural canvas textures — no external image assets.
 * Everything the world needs is painted at runtime.
 */
import * as THREE from 'three'
import { seededRandom } from './math'

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  return [c, ctx]
}

function toTexture(c: HTMLCanvasElement, repeat = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 4
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* ── Terrain: dark industrial ground with a faint technical grid ── */
export function makeTerrainTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(1024, 1024)
  const rnd = seededRandom(1337)

  ctx.fillStyle = '#0c0d0f'
  ctx.fillRect(0, 0, 1024, 1024)

  // mottled noise patches
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * 1024
    const y = rnd() * 1024
    const r = 2 + rnd() * 26
    const v = rnd()
    ctx.fillStyle =
      v < 0.5
        ? `rgba(18,19,22,${0.25 + rnd() * 0.3})`
        : `rgba(8,8,9,${0.25 + rnd() * 0.35})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // faint technical grid
  ctx.strokeStyle = 'rgba(58,62,68,0.16)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 16; i++) {
    const p = (i / 16) * 1024
    ctx.beginPath()
    ctx.moveTo(p, 0)
    ctx.lineTo(p, 1024)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, p)
    ctx.lineTo(1024, p)
    ctx.stroke()
  }
  // heavier grid every 4 cells
  ctx.strokeStyle = 'rgba(70,74,82,0.22)'
  for (let i = 0; i <= 4; i++) {
    const p = (i / 4) * 1024
    ctx.beginPath()
    ctx.moveTo(p, 0)
    ctx.lineTo(p, 1024)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, p)
    ctx.lineTo(1024, p)
    ctx.stroke()
  }

  return toTexture(c, 26)
}

/* ── Runway: asphalt, centreline, thresholds, edge lines ───────── */
export function makeRunwayTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 2048)

  // asphalt
  ctx.fillStyle = '#131418'
  ctx.fillRect(0, 0, 256, 2048)
  const rnd = seededRandom(77)
  for (let i = 0; i < 3200; i++) {
    const v = rnd()
    ctx.fillStyle =
      v < 0.55
        ? `rgba(22,23,27,${0.3 + rnd() * 0.4})`
        : `rgba(9,9,11,${0.3 + rnd() * 0.4})`
    ctx.fillRect(rnd() * 256, rnd() * 2048, 1 + rnd() * 2, 1 + rnd() * 2)
  }

  const paint = 'rgba(226,224,215,0.85)'

  // centreline dashes
  ctx.fillStyle = paint
  for (let y = 240; y < 2048 - 240; y += 96) {
    ctx.fillRect(124, y, 8, 56)
  }

  // thresholds (piano keys) both ends
  for (const baseY of [30, 2048 - 30 - 88]) {
    for (let i = 0; i < 6; i++) {
      const x = 26 + i * 36
      ctx.fillRect(x, baseY, 18, 88)
    }
  }

  // edge lines
  ctx.fillRect(8, 30, 4, 2048 - 60)
  ctx.fillRect(244, 30, 4, 2048 - 60)

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* ── Soft radial gradient sprite (glows, cloud puffs, blob shadow) ── */
export function makeRadialTexture(
  inner: string,
  outer: string,
  size = 128,
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(size, size)
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* ── Sky gradient dome (vertical) ──────────────────────────────── */
export function makeSkyTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(16, 512)
  const g = ctx.createLinearGradient(0, 0, 0, 512)
  g.addColorStop(0.0, '#04050a') // zenith — near black
  g.addColorStop(0.45, '#0a0d14') // mid sky
  g.addColorStop(0.78, '#141824') // horizon glow band
  g.addColorStop(0.88, '#1a1c22') // warm haze
  g.addColorStop(1.0, '#0c0d10') // below horizon
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 16, 512)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* ── B-2 skin: stealth panels + subtle noise ───────────────────── */
export function makeStealthSkinTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 512)
  const rnd = seededRandom(4242)

  ctx.fillStyle = '#17191d'
  ctx.fillRect(0, 0, 512, 512)

  // coating mottling
  for (let i = 0; i < 2000; i++) {
    const v = rnd()
    ctx.fillStyle =
      v < 0.5
        ? `rgba(26,28,33,${0.2 + rnd() * 0.3})`
        : `rgba(11,12,15,${0.2 + rnd() * 0.3})`
    ctx.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 4, 2 + rnd() * 4)
  }

  // panel lines grid — irregular
  ctx.strokeStyle = 'rgba(8,9,11,0.55)'
  ctx.lineWidth = 1
  for (let x = 0; x < 512; x += 42 + (x % 3) * 6) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 512)
    ctx.stroke()
  }
  for (let y = 0; y < 512; y += 38 + (y % 4) * 8) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(512, y)
    ctx.stroke()
  }

  // subtle sawtooth RAM strips
  ctx.strokeStyle = 'rgba(10,11,13,0.4)'
  for (let i = 0; i < 26; i++) {
    const y = rnd() * 512
    const x = rnd() * 512
    const w = 30 + rnd() * 60
    ctx.beginPath()
    for (let s = 0; s <= w; s += 8) {
      ctx.lineTo(x + s, y + (s % 16 === 0 ? 0 : 5))
    }
    ctx.stroke()
  }

  return toTexture(c, 1)
}

/* ── Floating station label sprite ─────────────────────────────── */
export function makeLabelTexture(
  index: string,
  title: string,
  sub: string,
  accent = '#e32636',
): THREE.CanvasTexture {
  const W = 640
  const H = 190
  const [c, ctx] = makeCanvas(W, H)

  ctx.fillStyle = 'rgba(8,8,8,0.72)'
  ctx.fillRect(6, 6, W - 12, H - 12)
  ctx.strokeStyle = 'rgba(119,119,119,0.9)'
  ctx.lineWidth = 2
  ctx.strokeRect(6, 6, W - 12, H - 12)
  // accent corner ticks
  ctx.strokeStyle = accent
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(6, 44)
  ctx.lineTo(6, 6)
  ctx.lineTo(44, 6)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(W - 6, H - 44)
  ctx.lineTo(W - 6, H - 6)
  ctx.lineTo(W - 44, H - 6)
  ctx.stroke()

  ctx.fillStyle = accent
  ctx.font = '700 40px "Rajdhani", "Arial Narrow", sans-serif'
  ctx.fillText(`${index} //`, 26, 66)

  ctx.fillStyle = '#f2f0e9'
  ctx.font = '700 52px "Rajdhani", "Arial Narrow", sans-serif'
  ctx.fillText(title, 26 + 110, 66)

  ctx.fillStyle = '#999999'
  ctx.font = '30px "Share Tech Mono", monospace'
  ctx.fillText(`> ${sub}`, 26, 126)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* ── Hazard stripes texture (industrial details) ───────────────── */
export function makeHazardTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 128)
  ctx.fillStyle = '#151517'
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = '#d9a441'
  ctx.lineWidth = 14
  for (let i = -128; i < 256; i += 44) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + 128, 128)
    ctx.stroke()
  }
  return toTexture(c, 1)
}

import { BufferGeometry, Float32BufferAttribute } from 'three'

export type B2GeometryQuality = 'low' | 'medium' | 'high'
type Point = [number, number, number]

/** Local coordinates: nose -Z, up +Y. The photograph informs the upper surface;
 * the parametric planform and closed underside remain procedural approximations. */
export const B2_DIMENSIONS = { span: 56, chord: 23 } as const

// Paired leading/trailing stations on the right half-wing. Keep the aft corners
// in the sampling grid: interpolating across them would erase the sawtooth edge.
export const B2_HALF_PLANFORM = [
  { x: 0, leading: -11.5, trailing: 8.7 },
  { x: 1.4, leading: -10.9, trailing: 9.55 },
  { x: 4.6, leading: -8.45, trailing: 11.5 },
  { x: 9.2, leading: -5.05, trailing: 7.65 },
  { x: 13.9, leading: -1.9, trailing: 3.35 },
  { x: 20.8, leading: 2.7, trailing: 8.65 },
  { x: 28, leading: 7.5, trailing: 8.15 },
] as const

export const B2_RECESSES = [
  { kind: 'intake', span: [3.65, 6.2], chord: [0.18, 0.33], depth: 0.58 },
  { kind: 'exhaust', span: [3.85, 6.65], chord: [0.74, 0.94], depth: 0.38 },
] as const

type Recess = (typeof B2_RECESSES)[number]

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function sampleB2Section(x: number) {
  const span = Math.min(28, Math.abs(x))
  for (let i = 1; i < B2_HALF_PLANFORM.length; i++) {
    const a = B2_HALF_PLANFORM[i - 1]
    const b = B2_HALF_PLANFORM[i]
    if (span <= b.x) {
      const t = (span - a.x) / (b.x - a.x)
      return { leading: lerp(a.leading, b.leading, t), trailing: lerp(a.trailing, b.trailing, t) }
    }
  }
  return { leading: 7.5, trailing: 8.15 }
}

/** Closed-trailing-edge airfoil envelope, normalized to approximately one. */
function airfoil(u: number) {
  return Math.max(0, 10 * (
    0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u ** 2 + 0.2843 * u ** 3 - 0.1036 * u ** 4
  ))
}

export function sampleB2Surface(x: number, chord: number) {
  const u = clamp01(chord)
  const section = sampleB2Section(x)
  const z = lerp(section.leading, section.trailing, u)
  const span = Math.min(1, Math.abs(x) / 28)
  const profile = airfoil(u)
  const edge = 0.015 + 0.04 * (1 - span) ** 2
  const wing = (0.54 * (1 - span) ** 1.3 + 0.025) * profile
  const camber = 0.11 * profile * (1 - 0.6 * span)
  const dihedral = 0.09 * span ** 2

  // Continuous height fields, not overlapping fuselage/nacelle primitives.
  // A global longitudinal envelope keeps the centre hump smooth through the
  // changing local wing chord; the edge envelope blends it back into the wing.
  const bodyProfile = airfoil(clamp01((z + 11.5) / 22.6))
  const edgeBlend = Math.sin(Math.PI * u) ** 0.65
  const body = 2.05 * Math.exp(-((x / 4.15) ** 2)) * bodyProfile * edgeBlend
  const shoulders = 0.62 * Math.exp(-(((Math.abs(x) - 4.8) / 2.05) ** 2)) * profile * edgeBlend

  return {
    z,
    top: dihedral + camber + edge + wing + body + shoulders,
    bottom: dihedral + camber * 0.15 - edge - wing * 0.58 - body * 0.24 - shoulders * 0.1,
  }
}

function pointOnTop(x: number, chord: number, lift = 0): Point {
  const surface = sampleB2Surface(x, chord)
  return [x, surface.top + lift, surface.z]
}

function topAt(x: number, z: number) {
  const section = sampleB2Section(x)
  return sampleB2Surface(x, (z - section.leading) / (section.trailing - section.leading)).top
}

class MeshBuilder {
  positions: number[] = []
  uvs: number[] = []
  indices: number[] = []

  vertex(point: Point, side = 1) {
    const [x, y, z] = point
    const index = this.positions.length / 3
    this.positions.push(x * side, y, z)
    // Undistorted planar UVs are provided for future authored assets; the
    // procedural aircraft deliberately does not use the old near-black map.
    this.uvs.push(x * side / B2_DIMENSIONS.span + 0.5, (z + 11.5) / B2_DIMENSIONS.chord)
    return index
  }

  triangle(a: Point, b: Point, c: Point, side = 1) {
    const ids = [a, b, c].map((point) => this.vertex(point, side))
    this.indices.push(...(side > 0 ? ids : [ids[0], ids[2], ids[1]]))
  }

  quad(a: Point, b: Point, c: Point, d: Point, side = 1) {
    const ids = [a, b, c, d].map((point) => this.vertex(point, side))
    const [i, j, k, l] = ids
    this.indices.push(...(side > 0 ? [i, j, l, j, k, l] : [i, l, j, j, l, k]))
  }

  finish(name: string) {
    const geometry = new BufferGeometry()
    geometry.name = name
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2))
    geometry.setIndex(this.indices)
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  }
}

function samples(quality: B2GeometryQuality) {
  const { step, divisions } = {
    low: { step: 0.85, divisions: 30 },
    medium: { step: 0.75, divisions: 36 },
    high: { step: 0.65, divisions: 42 },
  }[quality]
  const anchors = [...new Set<number>([
    ...B2_HALF_PLANFORM.map(({ x }) => x),
    ...B2_RECESSES.flatMap(({ span }) => [...span]),
  ])].sort((a, b) => a - b)
  const half = [0]
  for (let i = 1; i < anchors.length; i++) {
    const count = Math.ceil((anchors[i] - anchors[i - 1]) / step)
    for (let j = 1; j <= count; j++) half.push(lerp(anchors[i - 1], anchors[i], j / count))
  }
  // Cosine chord spacing resolves thin leading/trailing edges without spending
  // the entire triangle budget on the relatively flat middle of the wing.
  const chord = [...new Set([
    ...Array.from({ length: divisions + 1 }, (_, i) => (1 - Math.cos(Math.PI * i / divisions)) / 2),
    ...B2_RECESSES.flatMap((recess) => [...recess.chord]),
  ])].sort((a, b) => a - b)
  return { span: [...half.slice(1).reverse().map((x) => -x), ...half], chord }
}

function insideRecess(x: number, u: number) {
  return B2_RECESSES.some((recess) =>
    Math.abs(x) > recess.span[0] && Math.abs(x) < recess.span[1] &&
    u > recess.chord[0] && u < recess.chord[1],
  )
}

function buildHull(span: number[], chord: number[]) {
  const builder = new MeshBuilder()
  const columns = chord.length
  const top = new Map<number, number>()
  const bottom = new Map<number, number>()
  function vertex(i: number, j: number, upper: boolean) {
    const cache = upper ? top : bottom
    const key = i * columns + j
    const cached = cache.get(key)
    if (cached !== undefined) return cached
    const surface = sampleB2Surface(span[i], chord[j])
    const id = builder.vertex([span[i], upper ? surface.top : surface.bottom, surface.z])
    cache.set(key, id)
    return id
  }

  const counts: number[] = []
  for (const upper of [true, false]) {
    for (let i = 0; i < span.length - 1; i++) {
      for (let j = 0; j < chord.length - 1; j++) {
        // The openings remove skin triangles, rather than placing dark boxes
        // over an unbroken wing. The underside stays closed beneath the wells.
        if (upper && insideRecess((span[i] + span[i + 1]) / 2, (chord[j] + chord[j + 1]) / 2)) continue
        const a = vertex(i, j, upper)
        const b = vertex(i + 1, j, upper)
        const c = vertex(i, j + 1, upper)
        const d = vertex(i + 1, j + 1, upper)
        // Mirror the diagonal as well as the positions, so area-weighted
        // normals and tessellation remain symmetric at the centre seam.
        const faces = span[i] >= 0 ? [a, c, b, b, c, d] : [a, c, d, a, d, b]
        for (let k = 0; k < faces.length; k += 3) {
          builder.indices.push(faces[k], faces[k + (upper ? 1 : 2)], faces[k + (upper ? 2 : 1)])
        }
      }
    }
    counts.push(builder.indices.length)
  }

  const boundary: [number, number][] = [
    ...chord.map((_, j): [number, number] => [0, j]),
    ...span.slice(1).map((_, i): [number, number] => [i + 1, columns - 1]),
    ...chord.slice(0, -1).map((_, j): [number, number] => [span.length - 1, columns - 2 - j]),
    ...span.slice(1, -1).map((_, i): [number, number] => [span.length - 2 - i, 0]),
  ]
  for (let n = 0; n < boundary.length; n++) {
    const [i, j] = boundary[n]
    const [k, l] = boundary[(n + 1) % boundary.length]
    const a = sampleB2Surface(span[i], chord[j])
    const b = sampleB2Surface(span[k], chord[l])
    // Duplicate the rim vertices intentionally: upper/lower smooth normals
    // must not bleed across the thin, sharply cut perimeter or sawtooth tips.
    builder.quad(
      [span[i], a.top, a.z], [span[i], a.bottom, a.z],
      [span[k], b.bottom, b.z], [span[k], b.top, b.z],
    )
  }
  const geometry = builder.finish('B-2 continuous flying-wing shell')
  // All groups use the same skin material; the ranges also document winding.
  geometry.addGroup(0, counts[0], 0)
  geometry.addGroup(counts[0], counts[1] - counts[0], 0)
  geometry.addGroup(counts[1], builder.indices.length - counts[1], 0)
  return geometry
}

function addRecess(recess: Recess, span: number[], chord: number[], rims: MeshBuilder, interior: MeshBuilder) {
  const xs = span.filter((x) => x >= recess.span[0] - 1e-9 && x <= recess.span[1] + 1e-9)
  const us = chord.filter((u) => u >= recess.chord[0] - 1e-9 && u <= recess.chord[1] + 1e-9)
  const boundary: [number, number][] = [
    ...us.map((u): [number, number] => [xs[0], u]),
    ...xs.slice(1).map((x): [number, number] => [x, us[us.length - 1]]),
    ...us.slice(0, -1).reverse().map((u): [number, number] => [xs[xs.length - 1], u]),
    ...xs.slice(1, -1).reverse().map((x): [number, number] => [x, us[0]]),
  ]
  const cx = (recess.span[0] + recess.span[1]) / 2
  const cu = (recess.chord[0] + recess.chord[1]) / 2
  const section = sampleB2Section(cx)
  const insetU = 0.09 / (section.trailing - section.leading)
  const floor = (x: number, u: number): Point => {
    const surface = sampleB2Surface(x, u)
    const progress = clamp01((u - recess.chord[0]) / (recess.chord[1] - recess.chord[0]))
    const ramp = recess.kind === 'intake' ? 0.4 + 0.6 * progress : 1 - 0.35 * progress
    const depth = Math.min(recess.depth * ramp, (surface.top - surface.bottom) * 0.68)
    return [x, surface.top - depth, surface.z]
  }
  const outer = boundary.map(([x, u]) => pointOnTop(x, u))
  const inner = boundary.map(([x, u]) => [
    cx + (x - cx) * (1 - 0.16 / (recess.span[1] - recess.span[0])),
    cu + (u - cu) * (1 - 2 * insetU / (recess.chord[1] - recess.chord[0])),
  ] as const)
  const lip = inner.map(([x, u]) => pointOnTop(x, u, -0.035))
  const bed = inner.map(([x, u]) => floor(x, u))
  const center = floor(cx, cu)
  for (const side of [-1, 1]) {
    for (let i = 0; i < boundary.length; i++) {
      const j = (i + 1) % boundary.length
      rims.quad(outer[i], outer[j], lip[j], lip[i], side)
      interior.quad(lip[i], lip[j], bed[j], bed[i], side)
      interior.triangle(center, bed[i], bed[j], side)
    }
  }
}

function addCockpit(glass: MeshBuilder, frame: MeshBuilder) {
  // Two forward windscreens plus two swept side panes, all genuinely faceted.
  // Opaque tinted glazing needs neither a spherical bubble nor transmission.
  const coords: [number, number][] = [
    [0, -9.15], [1.12, -8.65], [1.0, -6.45], [0, -6.2],
    [1.88, -7.8], [1.72, -5.95],
  ]
  const points: Point[] = coords.map(([x, z]) => [x, topAt(x, z), z])
  const panes = [[0, 3, 2, 1], [1, 2, 5, 4]]
  // Lift this small faceted cap just enough to clear the curved body at every
  // sampled point, then skirt its perimeter back into the integrated hump.
  let lift = 0.035
  for (const [a, b, c, d] of panes) {
    for (const triangle of [[a, b, d], [b, c, d]]) {
      const [p, q, r] = triangle.map((id) => points[id])
      for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12 - i; j++) {
        const u = i / 12
        const v = j / 12
        const x = p[0] + (q[0] - p[0]) * u + (r[0] - p[0]) * v
        const z = p[2] + (q[2] - p[2]) * u + (r[2] - p[2]) * v
        const y = p[1] + (q[1] - p[1]) * u + (r[1] - p[1]) * v
        lift = Math.max(lift, topAt(x, z) - y + 0.025)
      }
    }
  }
  points.forEach((point) => { point[1] += lift })
  for (const side of [-1, 1]) {
    for (const ids of panes) {
      const pane = ids.map((id) => points[id])
      const center = pane.reduce<Point>((sum, p) => [sum[0] + p[0] / 4, sum[1] + p[1] / 4, sum[2] + p[2] / 4], [0, 0, 0])
      const inset = pane.map((p): Point => [lerp(center[0], p[0], 0.945), lerp(center[1], p[1], 0.945) + 0.008, lerp(center[2], p[2], 0.945)])
      frame.quad(pane[0], pane[1], pane[2], pane[3], side)
      glass.quad(inset[0], inset[1], inset[2], inset[3], side)
    }
    const outline = [0, 3, 2, 5, 4, 1]
    for (let i = 0; i < outline.length; i++) {
      const a = points[outline[i]]
      const b = points[outline[(i + 1) % outline.length]]
      if (a[0] === 0 && b[0] === 0) continue
      frame.quad(a, [a[0], topAt(a[0], a[2]) - 0.01, a[2]], [b[0], topAt(b[0], b[2]) - 0.01, b[2]], b, side)
    }
  }
}

function buildPanels(span: number[]) {
  const positions: number[] = []
  function path(points: [number, number][]) {
    for (const side of [-1, 1]) {
      for (let i = 1; i < points.length; i++) {
        const [x0, u0] = points[i - 1]
        const [x1, u1] = points[i]
        const count = Math.max(1, Math.ceil(Math.abs(x1 - x0) / 0.35), Math.ceil(Math.abs(u1 - u0) * 90))
        for (let j = 0; j < count; j++) {
          const x = lerp(x0, x1, (j + 0.5) / count)
          const u = lerp(u0, u1, (j + 0.5) / count)
          if (insideRecess(x, u)) continue
          for (const t of [j / count, (j + 1) / count]) {
            positions.push(...pointOnTop(lerp(x0, x1, t) * side, lerp(u0, u1, t), 0.018))
          }
        }
      }
    }
  }
  // Original sparse maintenance/control-surface seams, not a tiled grid,
  // photographic markings, insignia, or dark baked lighting.
  for (const u of [0.075, 0.79, 0.925]) path(span.filter((x) => x >= 7.2 && x <= 27.2).map((x) => [x, u]))
  for (const x of [9.2, 13.9, 20.8, 24.7]) path([[x, 0.79], [x, 0.985]])
  path([[2.4, 0.38], [2.8, 0.42], [2.8, 0.64], [2.4, 0.67]])
  path([[7.1, 0.39], [7.5, 0.43], [7.5, 0.68], [7.1, 0.71]])
  path([[1.25, 0.59], [2.02, 0.61], [2.02, 0.7], [1.25, 0.68], [1.25, 0.59]])
  const geometry = new BufferGeometry()
  geometry.name = 'B-2 original upper-surface panel seams'
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** CPU-only, deterministic geometry factory; no textures, DOM, lights, or flight state. */
export function createB2Geometry(quality: B2GeometryQuality = 'high') {
  const grid = samples(quality)
  const rims = new MeshBuilder()
  const interiors = new MeshBuilder()
  const glass = new MeshBuilder()
  const frame = new MeshBuilder()
  for (const recess of B2_RECESSES) addRecess(recess, grid.span, grid.chord, rims, interiors)
  addCockpit(glass, frame)
  return {
    hull: buildHull(grid.span, grid.chord),
    recessRims: rims.finish('B-2 beveled intake and exhaust lips'),
    recessInteriors: interiors.finish('B-2 recessed duct walls and ramps'),
    cockpitGlass: glass.finish('B-2 faceted cockpit panes'),
    cockpitFrame: frame.finish('B-2 cockpit framing'),
    panels: buildPanels(grid.span),
  }
}

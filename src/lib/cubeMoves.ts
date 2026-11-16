export type FaceKey = 'U' | 'F' | 'R' | 'B' | 'L' | 'D'
export type CubeCategory = 'programming' | 'ai' | 'iot' | 'tech' | 'hobbies' | 'personal'
export type TurnDirection = 1 | -1
export type CubeAxis = 'x' | 'y' | 'z'
export type GridPosition = readonly [number, number, number]
/** Row-major, exact signed-permutation matrix. No floating-point turn accumulation. */
export type CubeOrientation = readonly [number, number, number, number, number, number, number, number, number]
export interface CubeMove { face: FaceKey; direction: TurnDirection }
export interface CubeletState { id: string; position: GridPosition; orientation: CubeOrientation }

export const CATEGORY_FACES: Readonly<Record<CubeCategory, FaceKey>> = {
  programming: 'U', ai: 'F', iot: 'R', tech: 'B', hobbies: 'L', personal: 'D',
}
export const FACE_CATEGORIES: Readonly<Record<FaceKey, CubeCategory>> = {
  U: 'programming', F: 'ai', R: 'iot', B: 'tech', L: 'hobbies', D: 'personal',
}
export const FACE_LAYERS: Readonly<Record<FaceKey, { axis: CubeAxis; index: number; layer: 1 | -1; normal: GridPosition }>> = {
  U: { axis: 'y', index: 1, layer: 1, normal: [0, 1, 0] },
  F: { axis: 'z', index: 2, layer: 1, normal: [0, 0, 1] },
  R: { axis: 'x', index: 0, layer: 1, normal: [1, 0, 0] },
  B: { axis: 'z', index: 2, layer: -1, normal: [0, 0, -1] },
  L: { axis: 'x', index: 0, layer: -1, normal: [-1, 0, 0] },
  D: { axis: 'y', index: 1, layer: -1, normal: [0, -1, 0] },
}
export const IDENTITY_ORIENTATION: CubeOrientation = [1, 0, 0, 0, 1, 0, 0, 0, 1]

export function resolveFace(value: string): FaceKey | null {
  const key = value.trim()
  const face = key.toUpperCase()
  if (Object.hasOwn(FACE_LAYERS, face)) return face as FaceKey
  const category = key.toLowerCase()
  return Object.hasOwn(CATEGORY_FACES, category) ? CATEGORY_FACES[category as CubeCategory] : null
}

export function parseCubeletName(name: string): GridPosition | null {
  const match = /^cubelet_(-1|0|1)_(-1|0|1)_(-1|0|1)$/.exec(name)
  if (!match) return null
  const position: GridPosition = [Number(match[1]), Number(match[2]), Number(match[3])]
  return position.some((value) => value !== 0) ? position : null
}

/** Positive directions mean clockwise when looking at the face from outside. */
export function moveQuarterTurns(move: CubeMove): number {
  return -FACE_LAYERS[move.face].layer * move.direction
}

export function rotateGrid(position: GridPosition, axis: CubeAxis, quarterTurns: number): GridPosition {
  if (!Number.isInteger(quarterTurns)) throw new Error('Cube rotations must be whole quarter turns.')
  let [x, y, z] = position
  const count = ((quarterTurns % 4) + 4) % 4
  for (let turn = 0; turn < count; turn++) {
    if (axis === 'x') [y, z] = [-z, y]
    else if (axis === 'y') [x, z] = [z, -x]
    else [x, y] = [-y, x]
  }
  // Avoid -0 so exact equality and serialization stay canonical.
  return [x || 0, y || 0, z || 0]
}

export function rotateOrientation(orientation: CubeOrientation, axis: CubeAxis, quarterTurns: number): CubeOrientation {
  const a = rotateGrid([orientation[0], orientation[3], orientation[6]], axis, quarterTurns)
  const b = rotateGrid([orientation[1], orientation[4], orientation[7]], axis, quarterTurns)
  const c = rotateGrid([orientation[2], orientation[5], orientation[8]], axis, quarterTurns)
  return [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]]
}

export function transformByOrientation(position: GridPosition, m: CubeOrientation): GridPosition {
  return [
    (m[0] * position[0] + m[1] * position[1] + m[2] * position[2]) || 0,
    (m[3] * position[0] + m[4] * position[1] + m[5] * position[2]) || 0,
    (m[6] * position[0] + m[7] * position[1] + m[8] * position[2]) || 0,
  ]
}

export function isInLayer(cubelet: CubeletState, face: FaceKey): boolean {
  const layer = FACE_LAYERS[face]
  return cubelet.position[layer.index] === layer.layer
}

export function turnCubelet(cubelet: CubeletState, move: CubeMove): CubeletState {
  if (!isInLayer(cubelet, move.face)) return cubelet
  const axis = FACE_LAYERS[move.face].axis
  const quarterTurns = moveQuarterTurns(move)
  return {
    id: cubelet.id,
    position: rotateGrid(cubelet.position, axis, quarterTurns),
    orientation: rotateOrientation(cubelet.orientation, axis, quarterTurns),
  }
}

export function applyCubeMove(cubelets: readonly CubeletState[], move: CubeMove): CubeletState[] {
  return cubelets.map((cubelet) => turnCubelet(cubelet, move))
}

export function createSolvedCube(): CubeletState[] {
  const cubelets: CubeletState[] = []
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    if (x || y || z) cubelets.push({ id: `cubelet_${x}_${y}_${z}`, position: [x, y, z], orientation: IDENTITY_ORIENTATION })
  }
  return cubelets
}

export function inverseMove(move: CubeMove): CubeMove {
  return { face: move.face, direction: move.direction === 1 ? -1 : 1 }
}

/** An honest solve-from-history, not an arbitrary scrambled-state solver. */
export function inverseHistory(history: readonly CubeMove[]): CubeMove[] {
  return [...history].reverse().map(inverseMove)
}

export function areInverseMoves(a: CubeMove, b: CubeMove): boolean {
  return a.face === b.face && a.direction === -b.direction
}

/** Fixed seed by default, twelve turns, and no repeated adjacent face. */
export function createScramble(seed = 0xc0b3, length = 12): CubeMove[] {
  if (!Number.isInteger(length) || length < 0 || length > 256) throw new Error('Invalid scramble length.')
  const faces: FaceKey[] = ['U', 'F', 'R', 'B', 'L', 'D']
  let value = (seed >>> 0) || 1
  const random = () => {
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5
    return value >>> 0
  }
  const moves: CubeMove[] = []
  for (let index = 0; index < length; index++) {
    const choices = faces.filter((face) => face !== moves[index - 1]?.face)
    moves.push({ face: choices[random() % choices.length], direction: random() % 2 ? 1 : -1 })
  }
  return moves
}

import type { QualityLevel } from '../../stores/useExperienceStore'
import { SPAWN, STATIONS } from '../../config/stations'
import { VOXEL_QUALITY, VOXEL_WORLD } from '../../config/voxelWorld'
import { baseChunkCoordinates } from './generateVoxelWorld'

export interface FixedWorldChunk {
  readonly cx: number
  readonly cz: number
  readonly cellSize: number
  readonly detail: boolean
  /** Planning allowance for ground/water instances and authored decoration. */
  readonly estimatedInstances: number
}

export const FIXED_WORLD_LOD = {
  high: { fineCell: 14, fineLimit: 9, haloCell: 28, haloLimit: 16 },
  medium: { fineCell: 28, fineLimit: 12, haloCell: 56, haloLimit: 16 },
  low: { fineCell: 28, fineLimit: 6, haloCell: 56, haloLimit: 12 },
} as const

const manifests = new Map<QualityLevel, readonly FixedWorldChunk[]>()
const coordinateKey = (cx: number, cz: number) => `${cx}:${cz}`

/** One immutable, final LOD per coordinate; camera/flight state is never an input. */
export function fixedWorldManifest(quality: QualityLevel): readonly FixedWorldChunk[] {
  const cached = manifests.get(quality)
  if (cached) return cached

  const coordinates = baseChunkCoordinates()
  const valid = new Set(coordinates.map(([cx, cz]) => coordinateKey(cx, cz)))
  const size = VOXEL_WORLD.chunkSize
  const lod = FIXED_WORLD_LOD[quality]
  // Read the canonical layout, including relocated destinations, rather than duplicating it.
  const anchors = [{ x: SPAWN.x, z: SPAWN.z }, ...STATIONS.map((site) => ({ x: site.pos[0], z: site.pos[2] }))]
  const core = new Set<string>()
  const neighbors = new Map<string, { cx: number; cz: number; distance: number }>()
  for (const anchor of anchors) {
    const cx = Math.floor(anchor.x / size)
    const cz = Math.floor(anchor.z / size)
    const key = coordinateKey(cx, cz)
    if (valid.has(key)) core.add(key)
    // Only immediate neighbors, never a 25-chunk ring around every destination.
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx
      const nz = cz + dz
      const neighborKey = coordinateKey(nx, nz)
      if (!valid.has(neighborKey)) continue
      const distance = Math.hypot((nx + 0.5) * size - anchor.x, (nz + 0.5) * size - anchor.z)
      const previous = neighbors.get(neighborKey)
      if (!previous || distance < previous.distance) neighbors.set(neighborKey, { cx: nx, cz: nz, distance })
    }
  }
  const ranked = [...neighbors.values()].sort((a, b) => a.distance - b.distance || a.cz - b.cz || a.cx - b.cx)
  const fine = new Set([...core].slice(0, lod.fineLimit))
  for (const item of ranked) {
    if (fine.size >= lod.fineLimit) break
    fine.add(coordinateKey(item.cx, item.cz))
  }
  const halo = new Set<string>()
  for (const item of ranked) {
    if (halo.size >= lod.haloLimit) break
    const key = coordinateKey(item.cx, item.cz)
    if (!fine.has(key)) halo.add(key)
  }

  const manifest = Object.freeze(coordinates.map(([cx, cz]) => {
    const key = coordinateKey(cx, cz)
    const detail = fine.has(key) || halo.has(key)
    const cellSize = fine.has(key) ? lod.fineCell : halo.has(key) ? lod.haloCell : VOXEL_QUALITY[quality].farCell
    return Object.freeze({ cx, cz, cellSize, detail, estimatedInstances: 4 * (size / cellSize) ** 2 + (detail ? 600 : 100) })
  }))
  manifests.set(quality, manifest)
  return manifest
}

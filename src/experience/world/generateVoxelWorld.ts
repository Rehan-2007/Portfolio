import type { QualityLevel } from '../../stores/useExperienceStore'
import { FLOATING_ISLANDS, VOXEL_QUALITY, VOXEL_WORLD, WATERFALLS } from '../../config/voxelWorld'
import { sampleTerrain, sampleTreeSite, terrainHash } from '../../lib/voxelTerrain'
import type { TerrainSample, TreeSite } from '../../lib/voxelTerrain'
import type { VoxelBatchData, VoxelBatchKind, VoxelChunkData } from './voxelTypes'

export type { VoxelBatchData, VoxelChunkData } from './voxelTypes'

const palette = VOXEL_WORLD.palette
const colorCache = new Map<string, [number, number, number]>()
function linearColor(hex: string): [number, number, number] {
  const cached = colorCache.get(hex)
  if (cached) return cached
  const value = parseInt(hex.slice(1), 16)
  const result = [value >> 16, (value >> 8) & 255, value & 255].map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  colorCache.set(hex, result)
  return result
}

class Batch {
  private transforms: number[] = []
  private colors: number[] = []

  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, variation = 0): void {
    if (sy <= 0 || sx <= 0 || sz <= 0) return
    this.transforms.push(x, y, z, sx, sy, sz)
    const rgb = linearColor(color)
    const multiplier = 1 + variation * 0.16
    this.colors.push(rgb[0] * multiplier, rgb[1] * multiplier, rgb[2] * multiplier)
  }

  finish(kind: VoxelBatchKind): VoxelBatchData {
    return { kind, transforms: new Float32Array(this.transforms), colors: new Float32Array(this.colors), count: this.transforms.length / 6 }
  }
}

function surfaceColor(sample: TerrainSample): string {
  switch (sample.biome) {
    case 'road': case 'station': return palette.road
    case 'water': case 'shore': return palette.sand
    case 'alpine': return sample.height > 476 ? palette.snow : palette.stone
    case 'amber': return '#b5a45d'
    case 'highland': return palette.grassLight
    case 'forest': return '#548e44'
    default: return sample.hash < 0.25 ? palette.meadow : palette.grass
  }
}

function addTree(batch: Batch, tree: TreeSite, coarse: boolean): void {
  const { x, y, z, height, width, kind } = tree
  const leaf = kind === 'pink' ? palette.pinkLeaves : kind === 'spruce' ? palette.spruce : palette.leaves
  batch.add(x, y + height * 0.34, z, 6, height * 0.68, 6, kind === 'birch' ? palette.birch : palette.wood)
  if (kind === 'spruce') {
    for (let level = 0; level < (coarse ? 2 : 4); level++) {
      const t = level / (coarse ? 2 : 4)
      batch.add(x, y + height * (0.45 + t * 0.44), z, width * (1 - t * 0.75), height * 0.24, width * (1 - t * 0.75), leaf, t - 0.5)
    }
  } else {
    batch.add(x, y + height * 0.72, z, width, height * 0.37, width, leaf, tree.rank - 0.5)
    batch.add(x + 3, y + height * 0.92, z - 2, width * 0.7, height * 0.16, width * 0.68, leaf, 0.3)
    if (!coarse) {
      batch.add(x - width * 0.46, y + height * 0.66, z + 3, width * 0.35, height * 0.25, width * 0.68, leaf)
      batch.add(x + width * 0.4, y + height * 0.66, z - 3, width * 0.33, height * 0.24, width * 0.68, leaf, -0.2)
    }
  }
}

export function generateVoxelChunk(cx: number, cz: number, cellSize: number, quality: QualityLevel, detail = false): VoxelChunkData {
  const size = VOXEL_WORLD.chunkSize
  const x0 = cx * size
  const z0 = cz * size
  const count = size / cellSize
  const terrain = new Batch()
  const decor = new Batch()
  const water = new Batch()
  const heights = new Float32Array((count + 2) * (count + 2))
  const samples: TerrainSample[] = []
  for (let iz = -1; iz <= count; iz++) for (let ix = -1; ix <= count; ix++) {
    const sample = sampleTerrain(x0 + (ix + 0.5) * cellSize, z0 + (iz + 0.5) * cellSize)
    heights[(iz + 1) * (count + 2) + ix + 1] = sample.height
    if (iz >= 0 && iz < count && ix >= 0 && ix < count) samples.push(sample)
  }
  for (let iz = 0; iz < count; iz++) for (let ix = 0; ix < count; ix++) {
    const sample = samples[iz * count + ix]
    if (!sample.land) continue
    const x = x0 + (ix + 0.5) * cellSize
    const z = z0 + (iz + 0.5) * cellSize
    const h = sample.height
    const idx = (iz + 1) * (count + 2) + ix + 1
    const neighborFloor = Math.min(heights[idx - 1], heights[idx + 1], heights[idx - count - 2], heights[idx + count + 2])
    const boundary = ix === 0 || iz === 0 || ix === count - 1 || iz === count - 1
    const bottom = boundary ? Math.min(neighborFloor - 14, h - 140) : neighborFloor - 14
    const topThickness = sample.water ? 8 : 5
    const dirtDepth = Math.min(28, Math.max(0, h - topThickness - bottom))
    terrain.add(x, h - topThickness / 2, z, cellSize, topThickness, cellSize, surfaceColor(sample), sample.hash - 0.5)
    terrain.add(x, h - topThickness - dirtDepth / 2, z, cellSize, dirtDepth, cellSize, h > 350 ? palette.stone : palette.dirt, sample.hash - 0.5)
    const stoneTop = h - topThickness - dirtDepth
    terrain.add(x, (stoneTop + bottom) / 2, z, cellSize, stoneTop - bottom, cellSize, palette.stoneDark, sample.hash - 0.5)

    // Exactly adjacent, non-overlapping water surfaces: no coplanar inflation.
    if (sample.water) water.add(x, sample.waterLevel - 1, z, cellSize, 2, cellSize, palette.water, (sample.hash - 0.5) * 0.3)
    if (detail && sample.road && terrainHash(ix, iz, cx + cz + 40) < 0.08) {
      decor.add(x, h + 2, z, 4, 4, 9, palette.roadDark)
    }
    if (detail && sample.biome === 'meadow' && !sample.station && sample.hash < 0.026) {
      decor.add(x - 3, h + 1.5, z + 3, 2.2, 3, 2.2, palette.pinkLeaves)
      decor.add(x + 3, h + 2, z - 2, 2.2, 4, 2.2, palette.flower)
    }
  }

  // Stable decoration anchors; quality only reduces subset/detail, never resizes trees.
  for (let gz = Math.floor(z0 / 84); gz < (z0 + size) / 84; gz++) for (let gx = Math.floor(x0 / 84); gx < (x0 + size) / 84; gx++) {
    const tree = sampleTreeSite(gx, gz)
    if (!tree) continue
    const density = detail ? VOXEL_QUALITY[quality].treeDensity : 0.12
    if (tree.rank < density) addTree(decor, tree, !detail || quality === 'low')
  }

  for (const island of FLOATING_ISLANDS) {
    if (island.x + island.radius < x0 || island.x - island.radius > x0 + size || island.z + island.radius < z0 || island.z - island.radius > z0 + size) continue
    const step = detail ? 28 : 56
    for (let z = Math.ceil(z0 / step) * step + step / 2; z < z0 + size; z += step) for (let x = Math.ceil(x0 / step) * step + step / 2; x < x0 + size; x += step) {
      const d = Math.hypot(x - island.x, z - island.z) / island.radius
      if (d >= 1) continue
      const top = island.y + Math.floor((1 - d) * 2) * 14
      const depth = Math.max(14, Math.floor((1 - d) * island.depth / 14) * 14)
      terrain.add(x, top - depth / 2, z, step, depth, step, palette.stone, terrainHash(x, z) - 0.5)
      terrain.add(x, top + 2, z, step, 4, step, palette.grassLight)
    }
  }
  for (const fall of WATERFALLS) {
    if (fall.x < x0 || fall.x >= x0 + size || fall.z < z0 || fall.z >= z0 + size) continue
    water.add(fall.x, (fall.top + fall.bottom) / 2, fall.z, fall.width, fall.top - fall.bottom, 8, palette.waterLight)
    water.add(fall.x, fall.bottom + 1, fall.z + 20, fall.width + 28, 2, 42, '#c0e4df')
  }
  const batches = [terrain.finish('terrain'), decor.finish('decor'), water.finish('water')].filter((b) => b.count > 0)
  return { key: `${cx}:${cz}:${cellSize}:${detail ? quality : 'far'}`, cx, cz, cellSize, centre: [x0 + size / 2, 300, z0 + size / 2], radius: 880, batches, count: batches.reduce((sum, batch) => sum + batch.count, 0) }
}

export function generateVoxelClouds(quality: QualityLevel): VoxelBatchData {
  const clouds = new Batch()
  const count = VOXEL_QUALITY[quality].cloudClusters
  for (let i = 0; i < count; i++) {
    const x = (terrainHash(i, 11, 900) - 0.5) * 12000
    const z = (terrainHash(i, 12, 900) - 0.5) * 12000
    const y = 880 + terrainHash(i, 13, 900) * 850
    for (let j = 0; j < 5; j++) {
      const width = 90 + terrainHash(i, j, 901) * 180
      clouds.add(x + j * 85, y + (j % 2) * 35, z, width, 34 + width * 0.15, width * 0.7, j % 3 ? palette.cloud : palette.cloudShade)
    }
  }
  return clouds.finish('cloud')
}

export function baseChunkCoordinates(): Array<[number, number]> {
  const edge = VOXEL_WORLD.halfExtent / VOXEL_WORLD.chunkSize
  const result: Array<[number, number]> = []
  for (let cz = -edge; cz < edge; cz++) for (let cx = -edge; cx < edge; cx++) result.push([cx, cz])
  return result.sort((a, b) => Math.hypot(a[0] + 0.5, a[1] + 0.5) - Math.hypot(b[0] + 0.5, b[1] + 0.5))
}

export function desiredChunks(x: number, z: number, quality: QualityLevel): Array<{ cx: number; cz: number; cellSize: number }> {
  const config = VOXEL_QUALITY[quality]
  const cx = Math.floor(x / VOXEL_WORLD.chunkSize)
  const cz = Math.floor(z / VOXEL_WORLD.chunkSize)
  const edge = VOXEL_WORLD.halfExtent / VOXEL_WORLD.chunkSize
  const result = []
  for (let dz = -config.midRadius; dz <= config.midRadius; dz++) for (let dx = -config.midRadius; dx <= config.midRadius; dx++) {
    if (cx + dx < -edge || cx + dx >= edge || cz + dz < -edge || cz + dz >= edge) continue
    const cellSize = Math.max(Math.abs(dx), Math.abs(dz)) <= config.nearRadius ? config.nearCell : config.midCell
    result.push({ cx: cx + dx, cz: cz + dz, cellSize })
  }
  return result.sort((a, b) => a.cellSize - b.cellSize || Math.hypot(a.cx - cx, a.cz - cz) - Math.hypot(b.cx - cx, b.cz - cz))
}

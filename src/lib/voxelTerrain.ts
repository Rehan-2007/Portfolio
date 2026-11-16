import { STATIONS } from '../config/stations'
import { FLOATING_ISLANDS, LAKES, MOUNTAIN_RANGES, RIVER_PATH, VOXEL_WORLD } from '../config/voxelWorld'
import { clamp } from './math'

export type VoxelBiome = 'ocean' | 'shore' | 'meadow' | 'forest' | 'highland' | 'amber' | 'alpine' | 'road' | 'water' | 'station'
export interface TerrainSample {
  height: number
  rawHeight: number
  biome: VoxelBiome
  water: boolean
  waterLevel: number
  road: boolean
  station: boolean
  land: boolean
  forest: boolean
  hash: number
}

export interface TreeSite {
  x: number
  y: number
  z: number
  height: number
  width: number
  kind: 'oak' | 'spruce' | 'pink' | 'birch'
  rank: number
}

export function terrainHash(x: number, z: number, salt = 0): number {
  let h = Math.imul(Math.floor(x) ^ (VOXEL_WORLD.seed + salt), 374761393)
  h = Math.imul(h ^ Math.floor(z), 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function smooth(a: number, b: number, value: number): number {
  const t = clamp((value - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function noise(x: number, z: number, scale: number): number {
  const u = x / scale
  const v = z / scale
  const ix = Math.floor(u)
  const iz = Math.floor(v)
  const tx = smooth(0, 1, u - ix)
  const tz = smooth(0, 1, v - iz)
  const a = terrainHash(ix, iz)
  const b = terrainHash(ix + 1, iz)
  const c = terrainHash(ix, iz + 1)
  const d = terrainHash(ix + 1, iz + 1)
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz
}

export function segmentDistance(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax
  const dz = bz - az
  const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1)
  return Math.hypot(x - ax - t * dx, z - az - t * dz)
}

/** Canonical 14-unit height field: quality changes never reseed/reposition geography. */
export function sampleTerrain(worldX: number, worldZ: number): TerrainSample {
  const b = VOXEL_WORLD.baseBlock
  const x = Math.floor(worldX / b) * b + b / 2
  const z = Math.floor(worldZ / b) * b + b / 2
  const hash = terrainHash(x, z, 101)
  const radius = Math.hypot(x * 0.94, z)
  const coast = VOXEL_WORLD.islandRadius + (noise(x + 4200, z, 1400) - 0.5) * 720 - radius
  const land = coast > 0
  const hub = Math.hypot(x, z - 100) < 285
  let siteDistance = Infinity
  let siteHeight = 0
  let roadDistance = Infinity
  for (const site of STATIONS) {
    const distance = Math.hypot(x - site.pos[0], z - site.pos[2])
    if (distance < siteDistance) { siteDistance = distance; siteHeight = site.pos[1] }
    roadDistance = Math.min(roadDistance, segmentDistance(x, z, 0, 100, site.pos[0], site.pos[2]))
  }
  const station = siteDistance < 230
  const road = roadDistance < 24 && !station && !hub
  const corridor = roadDistance < 90 && radius < 1250
  let riverDistance = Infinity
  for (let i = 1; i < RIVER_PATH.length; i++) {
    riverDistance = Math.min(riverDistance, segmentDistance(x, z, ...RIVER_PATH[i - 1], ...RIVER_PATH[i]))
  }
  let lakeLevel: number | null = null
  for (const lake of LAKES) {
    if (((x - lake.x) / lake.radiusX) ** 2 + ((z - lake.z) / lake.radiusZ) ** 2 < 1) lakeLevel = lake.level
  }

  const rolling = (noise(x, z, 1200) - 0.35) * 132 + (noise(x + 400, z, 360) - 0.5) * 40
  let mountain = 0
  for (const range of MOUNTAIN_RANGES) {
    const distance = Math.hypot(x - range.x, z - range.z)
    const weight = 1 - smooth(range.radius * 0.12, range.radius, distance)
    const ridges = 0.54 + noise(x * 1.2 + range.x, z * 1.2, 310) * 0.48
    mountain = Math.max(mountain, range.height * weight * ridges)
  }
  let rawHeight = 42 + rolling + mountain - (1 - smooth(0, 620, coast)) * 180
  let waterLevel = VOXEL_WORLD.oceanLevel as number
  let water = land && (riverDistance < 62 || lakeLevel !== null)
  if (lakeLevel !== null) waterLevel = lakeLevel
  else if (riverDistance < 62) waterLevel = -56

  // Two connected stepped cascade pools, their falls are generated at their edges.
  if (x > -2275 && x < -2198 && z >= -1920 && z <= -1490) {
    water = true
    waterLevel = z < -1906 ? 154 : z < -1752 ? 42 : -42
  }
  if (water) rawHeight = waterLevel - 24
  else if (riverDistance < 135 && mountain < 130) {
    rawHeight = waterLevel + 14 + smooth(62, 135, riverDistance) * Math.max(0, rawHeight - waterLevel - 14)
  }
  if (hub || station || corridor) {
    const blend = hub || station ? 1 : 1 - smooth(24, 90, roadDistance)
    rawHeight += (siteHeight - rawHeight) * blend
    water = false
  }
  if (!land) { rawHeight = VOXEL_WORLD.seaLevel - 28; water = false }
  rawHeight = clamp(rawHeight, VOXEL_WORLD.seaLevel - 28, VOXEL_WORLD.maxTerrainHeight)
  const height = hub || station || road ? siteHeight : Math.round(rawHeight / b) * b
  let biome: VoxelBiome = 'meadow'
  if (!land) biome = 'ocean'
  else if (water) biome = 'water'
  else if (station) biome = 'station'
  else if (road) biome = 'road'
  else if (coast < 220 || height < -28) biome = 'shore'
  else if (height > 392) biome = 'alpine'
  else if (x > 1500 && z > 1700) biome = 'amber'
  else if (x > 350 && x < 2300 && z < 1200) biome = 'highland'
  else if (noise(x - 800, z + 1700, 1100) > 0.47) biome = 'forest'
  const forest = land && !water && !station && !hub && !corridor && coast > 220 && height < 390
  return { height, rawHeight, waterLevel, biome, water, road, station, land, forest, hash }
}

export function sampleTerrainHeight(x: number, z: number): number {
  return sampleTerrain(x, z).height
}

/** Tree locations and dimensions are independent of terrain LOD and graphics settings. */
export function sampleTreeSite(gx: number, gz: number): TreeSite | null {
  const rank = terrainHash(gx, gz, 803)
  if (rank > 0.35) return null
  const x = (gx + 0.5) * 84 + (terrainHash(gx, gz, 804) - 0.5) * 32
  const z = (gz + 0.5) * 84 + (terrainHash(gx, gz, 805) - 0.5) * 32
  const sample = sampleTerrain(x, z)
  if (!sample.forest || (sample.biome === 'meadow' && rank > 0.15)) return null
  const kind = sample.biome === 'highland'
    ? rank < 0.11 ? 'pink' : 'birch'
    : sample.biome === 'forest' ? 'spruce' : 'oak'
  return { x, y: sample.height, z, rank: rank / 0.35, kind, height: kind === 'spruce' ? 64 : 42, width: kind === 'spruce' ? 25 : 36 }
}

/** Conservative LOD surface envelope: avoid terrain/canopy clipping between samples. */
export function sampleObstacleHeight(x: number, z: number, altitude = Infinity): number {
  let height = sampleTerrainHeight(x, z)
  for (const cell of [28, 42, 56, 84, 140]) {
    height = Math.max(height, sampleTerrainHeight(Math.floor(x / cell) * cell + cell / 2, Math.floor(z / cell) * cell + cell / 2))
  }
  const gx = Math.floor(x / 84)
  const gz = Math.floor(z / 84)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const tree = sampleTreeSite(gx + dx, gz + dz)
    if (tree && Math.abs(x - tree.x) < tree.width / 2 + 8 && Math.abs(z - tree.z) < tree.width / 2 + 8) height = Math.max(height, tree.y + tree.height)
  }
  for (const island of FLOATING_ISLANDS) {
    if (Math.hypot(x - island.x, z - island.z) < island.radius + 14 && altitude > island.y - island.depth - 35) height = Math.max(height, island.y + 40)
  }
  return height
}

export function sampleFlightFloor(x: number, z: number, heading: number, altitude = Infinity): number {
  const fx = Math.sin(heading)
  const fz = -Math.cos(heading)
  const rx = Math.cos(heading)
  const rz = Math.sin(heading)
  return 18 + Math.max(
    sampleObstacleHeight(x, z, altitude),
    sampleObstacleHeight(x + fx * 42, z + fz * 42, altitude),
    sampleObstacleHeight(x + rx * 29, z + rz * 29, altitude),
    sampleObstacleHeight(x - rx * 29, z - rz * 29, altitude),
  )
}

export function sampleCameraFloor(x: number, z: number, altitude = Infinity): number {
  return sampleObstacleHeight(x, z, altitude) + 14
}

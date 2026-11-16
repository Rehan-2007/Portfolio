import type { QualityLevel } from '../stores/useExperienceStore'

/** One authored landscape, with distance LOD rather than a quality-dependent map. */
export const VOXEL_WORLD = {
  seed: 914_072,
  halfExtent: 5880,
  chunkSize: 840,
  baseBlock: 14,
  seaLevel: -112,
  oceanLevel: -70,
  islandRadius: 5480,
  maxTerrainHeight: 686,
  sunPosition: [-3600, 2200, -5700] as [number, number, number],
  palette: {
    grass: '#68a746', grassLight: '#83b95a', meadow: '#79ae4c',
    dirt: '#90694a', dirtLight: '#ad8159', stone: '#a3a09a', stoneDark: '#817f79',
    snow: '#eff1ec', sand: '#e4c88b', road: '#b9aa8c', roadDark: '#8f816c',
    wood: '#826046', leaves: '#4f883e', spruce: '#3b7351', birch: '#ddd7c7',
    pinkLeaves: '#e59eb4', flower: '#ffd373', water: '#4ba5b3', waterLight: '#80cbd1',
    cloud: '#fff0dc', cloudShade: '#e5ced3',
  },
} as const

export interface VoxelQualityConfig {
  /** Base terrain is always resident at this coarse cell size. */
  farCell: 84 | 140
  nearCell: 14 | 28
  midCell: 28 | 42 | 56
  nearRadius: number
  midRadius: number
  treeDensity: number
  detailRadius: number
  cloudClusters: number
  fogNear: number
  fogFar: number
  dpr: [number, number]
  cacheLimit: number
}

export const VOXEL_QUALITY: Record<QualityLevel, VoxelQualityConfig> = {
  low: { farCell: 140, nearCell: 28, midCell: 56, nearRadius: 0, midRadius: 1, treeDensity: 0.45, detailRadius: 1, cloudClusters: 18, fogNear: 1800, fogFar: 6400, dpr: [0.75, 1], cacheLimit: 16 },
  medium: { farCell: 84, nearCell: 28, midCell: 42, nearRadius: 1, midRadius: 2, treeDensity: 0.72, detailRadius: 2, cloudClusters: 30, fogNear: 2200, fogFar: 7600, dpr: [1, 1.25], cacheLimit: 36 },
  high: { farCell: 84, nearCell: 14, midCell: 28, nearRadius: 1, midRadius: 2, treeDensity: 1, detailRadius: 2, cloudClusters: 42, fogNear: 2600, fogFar: 8800, dpr: [1, 1.5], cacheLimit: 42 },
}

export const RIVER_PATH: ReadonlyArray<readonly [number, number]> = [
  [-3700, -5600], [-2920, -3920], [-2260, -2580], [-1160, -1380],
  [-690, -690], [-290, -500], [-180, 0], [-340, 660], [150, 1480],
  [980, 2480], [900, 3690], [2040, 5620],
]

export const LAKES = [
  { x: -1380, z: 480, radiusX: 420, radiusZ: 310, level: -42 },
  { x: 2030, z: 1970, radiusX: 410, radiusZ: 300, level: -56 },
  { x: -2380, z: -2040, radiusX: 260, radiusZ: 190, level: 154 },
] as const

export const MOUNTAIN_RANGES = [
  { x: -2630, z: -2640, radius: 1500, height: 620 },
  { x: -3870, z: -3630, radius: 1540, height: 590 },
  { x: 2460, z: -1830, radius: 1390, height: 550 },
  { x: 3810, z: 290, radius: 1500, height: 520 },
  { x: -1740, z: 3500, radius: 1610, height: 550 },
  { x: 940, z: -4290, radius: 1540, height: 600 },
] as const

/** Intentional floating plateaus from the world reference, not random cubes. */
export const FLOATING_ISLANDS = [
  { x: -1850, y: 560, z: -570, radius: 120, depth: 115 },
  { x: 1680, y: 650, z: -930, radius: 150, depth: 150 },
  { x: 760, y: 710, z: 2430, radius: 105, depth: 100 },
] as const

export const WATERFALLS = [
  { x: -2240, z: -1920, width: 42, top: 154, bottom: 42, direction: 'z' },
  { x: -2240, z: -1752, width: 42, top: 42, bottom: -42, direction: 'z' },
] as const

export const BIOME_CENTRES = {
  forest: [-1500, 550] as const,
  highland: [1600, -350] as const,
  amber: [2600, 2650] as const,
  meadow: [0, 140] as const,
} as const

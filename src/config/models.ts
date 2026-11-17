import { STATIONS } from './stations'
import { ACTIVE_AIRCRAFT, AIRCRAFT_SCALE } from './aircraft'
import { LANDMARK_GEOMETRY } from './landmarkGeometry'
import { getStation } from './stations'
import type { StationId } from './stations'

export type ModelId = StationId | 'aircraft' | 'environment'
export type Vector3Tuple = [number, number, number]
export interface ModelConfig {
  id: ModelId
  label: string
  assetPath: string | null
  position: Vector3Tuple
  /** Euler angles in radians; applied to a wrapper, not baked into source geometry. */
  rotation: Vector3Tuple
  scale: number | Vector3Tuple
  visible: boolean
  targetDimensions?: Vector3Tuple
  interaction: { enabled: boolean; station: StationId | null; radius: number; point: Vector3Tuple }
  animation: { clip: string | null; autoplay: boolean; loop: boolean; speed: number }
  decoder: { dracoPath: string | null }
  /** Map supplied mesh names to information face IDs. Do not guess unseen nodes. */
  faceNodes: Record<string, string>
  /** Optional layer mapping, only populated after inspecting separable cubelets. */
  cubeLayers: Record<string, string[]>
}

function entry(id: ModelId, label: string, station: StationId | null): ModelConfig {
  const site = STATIONS.find((item) => item.id === station)
  return {
    id, label, assetPath: null,
    position: site ? [site.pos[0], site.pos[1] + 7, site.pos[2]] : [0, 0, 0],
    rotation: [0, 0, 0], scale: 1, visible: true,
    interaction: { enabled: station !== null, station, radius: site?.enterRadius ?? 0, point: [0, 0, 0] },
    animation: { clip: null, autoplay: false, loop: true, speed: 1 },
    decoder: { dracoPath: null }, faceNodes: {}, cubeLayers: {},
  }
}

/** Asset paths are configured only after source conversion and validation. */
export const MODEL_CONFIG: Record<ModelId, ModelConfig> = {
  aircraft: { ...entry('aircraft', 'Supplied B-2 Spirit', null), assetPath: ACTIVE_AIRCRAFT.assetPath, rotation: [0, ACTIVE_AIRCRAFT.correctiveYaw, 0], scale: AIRCRAFT_SCALE },
  about: { ...entry('about', 'Predator laptop asset', 'about'), assetPath: '/models/laptop/predator-laptop.glb', scale: 20, rotation: [0, Math.PI, 0], targetDimensions: [320, 231, 209], interaction: { enabled: true, station: 'about', radius: 260, point: [0, 6, 0] } },
  cube: { ...entry('cube', "Supplied Rubik's Cube", 'cube'), assetPath: '/models/rubiks-cube/rubiks-cube.glb', position: [getStation('cube').pos[0], 157, getStation('cube').pos[2]], scale: 50, targetDimensions: [300, 300, 300], interaction: { enabled: true, station: 'cube', radius: 360, point: [0, 0, 0] } },
  lab: entry('lab', 'Engineering laboratory', 'lab'),
  archive: { ...entry('archive', 'Converted Minecraft winemaker structure', 'archive'), assetPath: '/models/projects/minecraft-archive.glb', scale: LANDMARK_GEOMETRY.archive.intendedScale, targetDimensions: [329, 238, 332.5], interaction: { enabled: true, station: 'archive', radius: 440, point: [0, 34, 1] } },
  shawarma: { ...entry('shawarma', 'Supplied Frankie wrap', 'shawarma'), assetPath: '/models/shawarma/frankie-wrap.glb', scale: LANDMARK_GEOMETRY.shawarma.intendedScale, targetDimensions: [18.69672, 60, 19.055745], interaction: { enabled: true, station: 'shawarma', radius: 190, point: [0, 4, 0] } },
  contact: entry('contact', 'Communication terminal', 'contact'),
  environment: entry('environment', 'Additional environment model', null),
}

export function validateModelConfig(config: ModelConfig): string | null {
  if (config.assetPath !== null && (!config.assetPath.startsWith('/models/') || !/\.(glb|gltf)$/i.test(config.assetPath))) return 'Use an actual local GLB/GLTF path under /models/.'
  const scale = typeof config.scale === 'number' ? [config.scale] : config.scale
  if (![...config.position, ...config.rotation, ...scale].every(Number.isFinite) || scale.some((value) => value <= 0)) return 'Model transforms must be finite and scale must be positive.'
  if (!Number.isFinite(config.animation.speed) || config.animation.speed < 0) return 'Animation speed must be finite and non-negative.'
  return null
}

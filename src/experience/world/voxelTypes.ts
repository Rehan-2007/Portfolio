import type { QualityLevel } from '../../stores/useExperienceStore'

export type VoxelBatchKind = 'terrain' | 'decor' | 'water' | 'cloud'
export interface VoxelBatchData {
  kind: VoxelBatchKind
  /** World-space x/y/z and size x/y/z, six numbers per instance. */
  transforms: Float32Array
  /** Linear RGB, three numbers per instance. */
  colors: Float32Array
  count: number
}
export interface VoxelChunkData {
  key: string
  cx: number
  cz: number
  cellSize: number
  centre: [number, number, number]
  radius: number
  batches: VoxelBatchData[]
  count: number
}
export interface ChunkRequest {
  id: number
  cx: number
  cz: number
  cellSize: number
  quality: QualityLevel
  detail: boolean
}
export type ChunkResponse = { id: number; chunk: VoxelChunkData } | { id: number; error: string }

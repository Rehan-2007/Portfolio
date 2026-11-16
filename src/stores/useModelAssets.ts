import { create } from 'zustand'
import type { ModelId } from '../config/models'

export interface ModelInspection {
  dimensions: [number, number, number]
  center: [number, number, number]
  meshes: number
  triangles: number
  materials: string[]
  textures: number
  animations: string[]
  nodes: string[]
  warnings: string[]
}
export interface ModelStatus {
  phase: 'empty' | 'loading' | 'ready' | 'error'
  message?: string
  inspection?: ModelInspection
  revision?: number
}
interface ModelAssetState {
  statuses: Partial<Record<ModelId, ModelStatus>>
  revisions: Partial<Record<ModelId, number>>
  selectedFace: string | null
  setStatus: (id: ModelId, status: ModelStatus) => void
  retry: (id: ModelId) => void
  selectFace: (face: string | null) => void
}
export const useModelAssets = create<ModelAssetState>((set) => ({
  statuses: {}, revisions: {}, selectedFace: null,
  setStatus: (id, status) => set((state) => ({ statuses: { ...state.statuses, [id]: status } })),
  retry: (id) => set((state) => ({ revisions: { ...state.revisions, [id]: (state.revisions[id] ?? 0) + 1 } })),
  selectFace: (selectedFace) => set({ selectedFace }),
}))

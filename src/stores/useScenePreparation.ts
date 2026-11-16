import { create } from 'zustand'
import type { QualityLevel } from './useExperienceStore'

interface ScenePreparation {
  ready: boolean
  rendererReady: boolean
  terrainQuality: QualityLevel | null
  requestedQuality: QualityLevel | null
  terrainCompleted: number
  terrainTotal: number
  stage: string
  error: string | null
  epoch: number
  begin: (quality: QualityLevel) => void
  measured: () => void
  terrainProgress: (completed: number, total: number, error: string | null) => void
  terrainCommitted: (quality: QualityLevel) => void
  warming: () => void
  complete: (epoch: number) => void
  fail: (message: string) => void
  contextLost: () => void
}

/** One reveal state shared by DOM loading, terrain preparation and GPU warmup. */
export const useScenePreparation = create<ScenePreparation>((set, get) => ({
  ready: false, rendererReady: false, terrainQuality: null, requestedQuality: null,
  terrainCompleted: 0, terrainTotal: 196, stage: 'Preparing complete world', error: null, epoch: 0,
  begin: (quality) => {
    if (get().requestedQuality === quality) return
    set({ requestedQuality: quality, ready: false, terrainCompleted: 0, stage: 'Building complete terrain', error: null, epoch: get().epoch + 1 })
  },
  measured: () => set({ rendererReady: true }),
  terrainProgress: (terrainCompleted, terrainTotal, error) => set({ terrainCompleted, terrainTotal, ...(error ? { error, ready: false, stage: 'Terrain preparation failed' } : {}) }),
  terrainCommitted: (terrainQuality) => set({ terrainQuality }),
  warming: () => set({ ready: false, stage: 'Preparing textures and shaders' }),
  complete: (epoch) => { if (get().epoch === epoch) set({ ready: true, stage: 'Complete world ready', error: null }) },
  fail: (error) => set({ error, ready: false, stage: 'World preparation failed' }),
  contextLost: () => set({ ready: false, rendererReady: false, epoch: get().epoch + 1, stage: 'Restoring graphics resources' }),
}))

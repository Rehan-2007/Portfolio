import { MODEL_CONFIG } from '../config/models'
import type { ModelId } from '../config/models'
import type { ModelStatus } from '../stores/useModelAssets'

export const ESSENTIAL_MODELS: readonly ModelId[] = Object.values(MODEL_CONFIG).filter((model) => model.visible && model.assetPath !== null).map((model) => model.id)

interface ReadinessInput {
  rendererReady: boolean
  terrainComplete: boolean
  statuses: Partial<Record<ModelId, ModelStatus>>
  revisions: Partial<Record<ModelId, number>>
}

export function readinessPrerequisites(input: ReadinessInput): { ready: boolean; error: string | null } {
  for (const id of ESSENTIAL_MODELS) {
    const status = input.statuses[id]
    if (status?.phase === 'error') return { ready: false, error: `${MODEL_CONFIG[id].label}: ${status.message ?? 'Asset loading failed'}` }
  }
  if (!input.rendererReady || !input.terrainComplete) return { ready: false, error: null }
  const ready = ESSENTIAL_MODELS.every((id) => input.statuses[id]?.phase === 'ready' && input.statuses[id]?.revision === (input.revisions[id] ?? 0))
  return { ready, error: null }
}

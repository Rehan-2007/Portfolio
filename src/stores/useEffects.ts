import { create } from 'zustand'
import { effectsInput, projectilePool } from '../lib/projectiles'

export interface EffectsStore {
  /** Decorative effects are opt-in and deliberately not persisted. */
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  toggle: () => void
  reload: () => boolean
  reset: () => void
}

/** React subscribes to enabled only; HUDs can sample effectState counters without frame renders. */
export const useEffects = create<EffectsStore>((set, get) => ({
  enabled: false,
  setEnabled: (enabled) => {
    projectilePool.setEnabled(enabled)
    if (!enabled) effectsInput.fire = false
    set({ enabled })
  },
  toggle: () => get().setEnabled(!get().enabled),
  reload: () => projectilePool.startReload(),
  reset: () => {
    projectilePool.reset()
    effectsInput.fire = false
    effectsInput.boost = false
    set({ enabled: false })
  },
}))

export function toggleEffects(): void { useEffects.getState().toggle() }
export function startReload(): boolean { return useEffects.getState().reload() }
export function resetEffects(): void { useEffects.getState().reset() }

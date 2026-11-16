import { useEffect } from 'react'
import { effectsInput } from '../lib/projectiles'
import { useEffects } from '../stores/useEffects'
import { useExperienceStore } from '../stores/useExperienceStore'
import { useModelAssets } from '../stores/useModelAssets'

export const actionInput = effectsInput
const held = { keyboardFire: false, pointerFire: false, keyboardBoost: false, touchFire: false, touchBoost: false }
const shiftKeys = new Set<string>()
const blockedTarget = (target: EventTarget | null) => target instanceof Element && !!target.closest('button,a,input,textarea,select,summary,dialog,[role="button"],.touch-controls,.audio-controls')
const allowed = () => {
  const state = useExperienceStore.getState()
  return state.phase === 'flying' && !state.paused && !state.uiOpen && !state.activeStation && useModelAssets.getState().statuses.aircraft?.phase === 'ready'
}
function sync() {
  actionInput.fire = allowed() && useEffects.getState().enabled && (held.keyboardFire || held.pointerFire || held.touchFire)
  actionInput.boost = allowed() && (held.keyboardBoost || held.touchBoost)
}
export function clearSimulatorActions(): void { shiftKeys.clear(); Object.keys(held).forEach((key) => { held[key as keyof typeof held] = false }); Object.assign(actionInput, { fire: false, boost: false }) }
export function setTouchAction(action: 'fire' | 'boost', down: boolean): void { held[action === 'fire' ? 'touchFire' : 'touchBoost'] = down; sync() }

/** Held actions only; discrete F/R/X mappings remain in the existing UI dispatcher. */
export function useSimulatorActions(): void {
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (blockedTarget(event.target) || !allowed()) return
      if (event.code === 'KeyF' && useEffects.getState().enabled) { held.keyboardFire = true; event.preventDefault() }
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { shiftKeys.add(event.code); held.keyboardBoost = true }
      sync()
    }
    const up = (event: KeyboardEvent) => {
      if (event.code === 'KeyF') held.keyboardFire = false
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { shiftKeys.delete(event.code); held.keyboardBoost = shiftKeys.size > 0 }
      sync()
    }
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === 'touch' || blockedTarget(event.target) || !allowed() || !useEffects.getState().enabled) return
      if (!(event.target instanceof Element) || !event.target.closest('.flight-ui,.flight-canvas,canvas')) return
      held.pointerFire = true; sync(); event.preventDefault()
    }
    const pointerUp = () => { held.pointerFire = false; sync() }
    const visibility = () => { if (document.visibilityState !== 'visible') clearSimulatorActions() }
    const focusInput = (event: FocusEvent) => { if (blockedTarget(event.target)) clearSimulatorActions() }
    window.addEventListener('focusin', focusInput)
    const unsubscribe = useExperienceStore.subscribe((state) => { if (state.paused || state.uiOpen || state.activeStation) clearSimulatorActions() })
    const effectUnsubscribe = useEffects.subscribe(() => clearSimulatorActions())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('pointerdown', pointerDown)
    window.addEventListener('pointerup', pointerUp)
    window.addEventListener('pointercancel', pointerUp)
    window.addEventListener('blur', clearSimulatorActions)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      unsubscribe(); effectUnsubscribe(); clearSimulatorActions()
      window.removeEventListener('focusin', focusInput)
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up)
      window.removeEventListener('pointerdown', pointerDown); window.removeEventListener('pointerup', pointerUp); window.removeEventListener('pointercancel', pointerUp)
      window.removeEventListener('blur', clearSimulatorActions); document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
}

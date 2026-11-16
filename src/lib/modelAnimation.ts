import type { AnimationAction } from 'three'
import { LoopOnce, LoopRepeat } from 'three'
import type { ModelConfig } from '../config/models'

/** Three's mutable animation API is deliberately isolated from React hook values. */
export function startModelAnimation(action: AnimationAction, settings: ModelConfig['animation']): () => void {
  action.setLoop(settings.loop ? LoopRepeat : LoopOnce, settings.loop ? Infinity : 1)
  action.clampWhenFinished = !settings.loop
  action.setEffectiveTimeScale(settings.speed)
  action.reset().play()
  return () => { action.stop() }
}

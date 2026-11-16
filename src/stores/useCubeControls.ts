import { create } from 'zustand'
import {
  areInverseMoves, createScramble, FACE_CATEGORIES, inverseHistory, resolveFace,
} from '../lib/cubeMoves'
import type { CubeMove, TurnDirection } from '../lib/cubeMoves'
import { useModelAssets } from './useModelAssets'

export interface QueuedCubeTurn {
  id: number
  move: CubeMove
  source: 'manual' | 'scramble' | 'solve'
}
export interface CubeControlState {
  queue: readonly QueuedCubeTurn[]
  activeTurn: QueuedCubeTurn | null
  /** Only completed turns. Empty means returned to the imported baseline. */
  history: readonly CubeMove[]
  solving: boolean
  error: string | null
  enqueueTurn: (faceOrCategory: string, direction?: TurnDirection) => boolean
  rotate: (faceOrCategory: string, direction?: TurnDirection) => boolean
  scramble: () => boolean
  /** Finishes queued turns, then animates their complete inverse history. */
  solve: () => boolean
  selectFace: (faceOrCategory: string | null) => boolean
  // Controller lifecycle actions; UI should use the actions above.
  beginNextTurn: () => QueuedCubeTurn | null
  completeTurn: (id: number) => void
  fail: (message: string) => void
  reset: () => void
}

let nextTurnId = 1
const queued = (moves: readonly CubeMove[], source: QueuedCubeTurn['source']): QueuedCubeTurn[] =>
  moves.map((move) => ({ id: nextTurnId++, move: { ...move }, source }))

export const useCubeControls = create<CubeControlState>((set, get) => {
  const enqueueTurn: CubeControlState['enqueueTurn'] = (faceOrCategory, direction = 1) => {
    const face = resolveFace(faceOrCategory)
    const state = get()
    if (!face || (direction !== 1 && direction !== -1) || state.solving || state.error || state.queue.length >= 256) return false
    set({ queue: [...state.queue, ...queued([{ face, direction }], 'manual')] })
    return true
  }
  return {
    queue: [], activeTurn: null, history: [], solving: false, error: null,
    enqueueTurn, rotate: enqueueTurn,
    scramble: () => {
      const state = get()
      if (state.solving || state.error || state.queue.length > 244) return false
      set({ queue: [...state.queue, ...queued(createScramble(), 'scramble')] })
      return true
    },
    solve: () => {
      const state = get()
      if (state.solving || state.error) return false
      const planned = [...state.history, ...(state.activeTurn ? [state.activeTurn.move] : []), ...state.queue.map((turn) => turn.move)]
      if (!planned.length) return false
      set({ solving: true, queue: [...state.queue, ...queued(inverseHistory(planned), 'solve')] })
      return true
    },
    selectFace: (value) => {
      if (value === null) { useModelAssets.getState().selectFace(null); return true }
      const face = resolveFace(value)
      if (!face) return false
      useModelAssets.getState().selectFace(FACE_CATEGORIES[face])
      return true
    },
    beginNextTurn: () => {
      const state = get()
      if (state.activeTurn || state.error || !state.queue.length) return null
      const [activeTurn, ...queue] = state.queue
      set({ activeTurn, queue })
      return activeTurn
    },
    completeTurn: (id) => {
      const state = get()
      const active = state.activeTurn
      if (!active || active.id !== id) return
      if (active.source === 'solve') {
        const last = state.history.at(-1)
        if (!last || !areInverseMoves(last, active.move)) {
          get().fail('Cube history changed; solve-from-history cannot continue safely.')
          return
        }
        set({ history: state.history.slice(0, -1), activeTurn: null, solving: state.queue.length > 0 })
      } else {
        set({ history: [...state.history, active.move], activeTurn: null })
      }
    },
    fail: (error) => set({ error, queue: [], activeTurn: null, solving: false }),
    reset: () => set({ queue: [], activeTurn: null, history: [], solving: false, error: null }),
  }
})

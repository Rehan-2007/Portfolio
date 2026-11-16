/** Convert wall-clock milliseconds into a monotonic, bounded simulation clock. */
export function createSimulationClock(initialSeconds = 0) {
  let previousMs: number | null = null
  let elapsedSeconds = Number.isFinite(initialSeconds) ? Math.max(0, initialSeconds) : 0
  return {
    tick(nowMs: number): number {
      if (!Number.isFinite(nowMs) || (previousMs !== null && nowMs < previousMs)) return elapsedSeconds
      if (previousMs !== null) elapsedSeconds += Math.min((nowMs - previousMs) / 1000, 0.1)
      previousMs = nowMs
      return elapsedSeconds
    },
    suspend(): void { previousMs = null },
  }
}

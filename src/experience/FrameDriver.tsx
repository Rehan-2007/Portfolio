import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { createSimulationClock } from '../lib/simulationClock'

/** One seconds-based clock shared by RAF and the 30 Hz stalled-RAF fallback. */
export function FrameDriver() {
  const advance = useThree((state) => state.advance)
  const clock = useThree((state) => state.clock)
  useEffect(() => {
    const simulation = createSimulationClock(clock.elapsedTime)
    let frameId = 0
    let lastRafMs = performance.now()
    let lastAdvanceMs = -Infinity
    let frames = 0
    const verifyMode = import.meta.env.DEV && new URLSearchParams(location.search).has('verify')
    const visible = () => verifyMode || document.visibilityState === 'visible'
    const step = (nowMs: number) => {
      if (!visible()) { simulation.suspend(); return }
      if (nowMs - lastAdvanceMs < 4) return
      lastAdvanceMs = nowMs
      advance(simulation.tick(nowMs), true)
      frames++
    }
    const renderFrame = (nowMs: number) => {
      lastRafMs = nowMs
      step(nowMs)
      frameId = window.requestAnimationFrame(renderFrame)
    }
    frameId = window.requestAnimationFrame(renderFrame)
    const fallback = window.setInterval(() => {
      const nowMs = performance.now()
      if (nowMs - lastRafMs > 250) step(nowMs)
      if (import.meta.env.DEV) Object.assign(window, { __ANTI_AI_FRAME__: { count: frames, elapsedSeconds: clock.elapsedTime, fallback: nowMs - lastRafMs > 250 } })
    }, 1000 / 30)
    const onVisibility = () => simulation.suspend()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearInterval(fallback)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [advance, clock])
  return null
}

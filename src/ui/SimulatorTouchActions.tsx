import { useEffect } from 'react'
import type { PointerEvent } from 'react'
import { setTouchAction } from '../hooks/useSimulatorActions'
import { useEffects } from '../stores/useEffects'

export function SimulatorTouchActions() {
  const enabled = useEffects((state) => state.enabled)
  const toggle = useEffects((state) => state.toggle)
  const reload = useEffects((state) => state.reload)
  useEffect(() => () => { setTouchAction('boost', false); setTouchAction('fire', false) }, [])
  const hold = (action: 'boost' | 'fire') => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setTouchAction(action, true) },
    onPointerUp: () => setTouchAction(action, false),
    onPointerCancel: () => setTouchAction(action, false),
    onLostPointerCapture: () => setTouchAction(action, false),
  })
  return <div className="simulator-touch-actions" aria-label="Touch boost and fictional effects">
    <button type="button" {...hold('boost')}>Hold boost</button>
    <button type="button" onClick={toggle} aria-pressed={enabled}>Effects {enabled ? 'ON' : 'OFF'}</button>
    {enabled && <><button type="button" {...hold('fire')}>Hold fire</button><button type="button" onClick={reload}>Reload</button></>}
  </div>
}

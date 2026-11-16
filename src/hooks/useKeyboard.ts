import { useEffect, useRef } from 'react'

/** Global keyboard state, readable from useFrame without re-renders. */
export interface KeyboardState {
  down: (code: string) => boolean
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)
  )
}

export function useKeyboard(): KeyboardState {
  const keys = useRef<Set<string>>(new Set())

  useEffect(() => {
    const clear = () => keys.current.clear()
    const onDown = (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target)) return
      keys.current.add(event.code)
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)
      ) {
        event.preventDefault()
      }
    }
    const onUp = (event: KeyboardEvent) => keys.current.delete(event.code)
    const onFocus = (event: FocusEvent) => { if (isInteractiveTarget(event.target)) clear() }
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') clear()
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    window.addEventListener('focusin', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
      window.removeEventListener('focusin', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return { down: (code: string) => keys.current.has(code) }
}

/** Virtual axes shared by the touch controls and the flight loop. */
export const virtualInput = {
  throttle: 0,
  turn: 0,
  vertical: 0,
}

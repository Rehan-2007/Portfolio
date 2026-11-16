import { useEffect, useState } from 'react'

function detectTouch(): boolean {
  if (typeof window === 'undefined') return false
  return (
    (window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0) &&
    window.innerWidth < 1280
  )
}

/** Responsive coarse-pointer / small-screen detection for touch controls. */
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(detectTouch)

  useEffect(() => {
    const pointer = window.matchMedia('(pointer: coarse)')
    const update = () => setIsTouch(detectTouch())

    pointer.addEventListener('change', update)
    window.addEventListener('resize', update)
    return () => {
      pointer.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return isTouch
}

let webGL2Support: boolean | undefined

/** Three.js r187 requires a WebGL2 rendering context. */
export function hasWebGL(): boolean {
  if (new URLSearchParams(window.location.search).has('fallback')) return false
  if (webGL2Support !== undefined) return webGL2Support
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: false,
    })
    webGL2Support = context !== null
  } catch {
    webGL2Support = false
  }
  return webGL2Support
}

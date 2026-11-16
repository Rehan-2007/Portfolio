import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

interface ContextGuardProps {
  onLost: () => void
  onRestored: () => void
  onReady: () => void
}

export function ContextGuard({ onLost, onRestored, onReady }: ContextGuardProps) {
  const gl = useThree((state) => state.gl)
  const setSize = useThree((state) => state.setSize)

  useEffect(() => {
    const canvas = gl.domElement
    const container = canvas.parentElement
    let ready = false

    const measure = () => {
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      setSize(rect.width, rect.height, rect.top, rect.left)
      if (!ready) {
        ready = true
        onReady()
      }
    }
    const handleLost = (event: Event) => {
      event.preventDefault()
      onLost()
    }
    const handleRestored = () => {
      ready = false
      measure()
      onRestored()
    }

    const observer = new ResizeObserver(measure)
    if (container) observer.observe(container)
    window.addEventListener('resize', measure)
    canvas.addEventListener('webglcontextlost', handleLost)
    canvas.addEventListener('webglcontextrestored', handleRestored)
    measure()

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      canvas.removeEventListener('webglcontextlost', handleLost)
      canvas.removeEventListener('webglcontextrestored', handleRestored)
    }
  }, [gl, onLost, onReady, onRestored, setSize])

  return null
}

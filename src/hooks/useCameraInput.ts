import { useEffect } from 'react'
import { useEffects } from '../stores/useEffects'

/** Read from the render loop without subscribing or re-rendering. Angles are radians. */
export const cameraInput = { yaw: 0, pitch: 0, zoom: 1 }
export const CAMERA_INPUT_LIMITS = {
  yaw: Math.PI,
  pitch: 0.65,
  minZoom: 0.55,
  maxZoom: 1.8,
} as const

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** Positive yaw looks right, positive pitch raises the camera; larger zoom means farther away. */
export function setCameraOffset(offset: Partial<typeof cameraInput>): void {
  if (offset.yaw !== undefined && Number.isFinite(offset.yaw)) {
    cameraInput.yaw = clamp(offset.yaw, -CAMERA_INPUT_LIMITS.yaw, CAMERA_INPUT_LIMITS.yaw)
  }
  if (offset.pitch !== undefined && Number.isFinite(offset.pitch)) {
    cameraInput.pitch = clamp(offset.pitch, -CAMERA_INPUT_LIMITS.pitch, CAMERA_INPUT_LIMITS.pitch)
  }
  if (offset.zoom !== undefined && Number.isFinite(offset.zoom)) {
    cameraInput.zoom = clamp(offset.zoom, CAMERA_INPUT_LIMITS.minZoom, CAMERA_INPUT_LIMITS.maxZoom)
  }
}

export function resetCameraInput(): void {
  Object.assign(cameraInput, { yaw: 0, pitch: 0, zoom: 1 })
}

const INTERACTIVE = 'button, a, input, textarea, select, summary, dialog, [role="button"], [role="dialog"], [contenteditable]:not([contenteditable="false"]), .touch-controls, .camera-switcher, .topbar-actions, .control-deck, .pause-card, [data-camera-input="ignore"]'
const hasDialog = () => document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not([hidden])') !== null
const isFlightBackground = (target: EventTarget | null): target is Element =>
  target instanceof Element && !target.closest(INTERACTIVE) &&
  target.closest('.flight-ui, .flight-canvas, .experience-shell canvas') !== null

/** Mount once in FollowCamera. Disabling cancels gestures but keeps the chosen viewpoint. */
export function useCameraInput(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    let drag: { id: number; x: number; y: number; element: Element } | null = null
    const cancel = () => {
      const previous = drag
      drag = null
      if (previous?.element.hasPointerCapture(previous.id)) {
        previous.element.releasePointerCapture(previous.id)
      }
    }
    const down = (event: PointerEvent) => {
      // Touch input is handled only by the dedicated camera pad, never by the flight joystick.
      const cameraButton = useEffects.getState().enabled ? 2 : 0
      if (drag || event.pointerType === 'touch' || event.button !== cameraButton || hasDialog() || !isFlightBackground(event.target)) return
      event.preventDefault()
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, element: event.target }
      event.target.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return
      if (!event.buttons || hasDialog()) { cancel(); return }
      event.preventDefault()
      setCameraOffset({
        yaw: cameraInput.yaw + (event.clientX - drag.x) * 0.006,
        pitch: cameraInput.pitch - (event.clientY - drag.y) * 0.006,
      })
      drag.x = event.clientX
      drag.y = event.clientY
    }
    const end = (event: PointerEvent) => { if (drag?.id === event.pointerId) cancel() }
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || hasDialog() || !isFlightBackground(event.target)) return
      event.preventDefault()
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1
      const delta = clamp(event.deltaY * units, -240, 240)
      setCameraOffset({ zoom: cameraInput.zoom * Math.exp(delta * 0.0015) })
    }
    const visibility = () => { if (document.visibilityState !== 'visible') cancel() }
    const contextMenu = (event: MouseEvent) => { if (useEffects.getState().enabled && isFlightBackground(event.target)) event.preventDefault() }
    const unsubscribe = useEffects.subscribe(cancel)
    window.addEventListener('contextmenu', contextMenu)
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('lostpointercapture', end)
    window.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      unsubscribe()
      window.removeEventListener('contextmenu', contextMenu)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('lostpointercapture', end)
      window.removeEventListener('wheel', wheel)
      window.removeEventListener('blur', cancel)
      document.removeEventListener('visibilitychange', visibility)
      cancel()
    }
  }, [enabled])
}

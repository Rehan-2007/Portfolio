import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { cameraInput, resetCameraInput, setCameraOffset } from '../hooks/useCameraInput'
import { virtualInput } from '../hooks/useKeyboard'
import './touch-controls.css'

type Axis = keyof typeof virtualInput
type Hold = (source: string, axis: Axis, value: number) => void
const clamp = (value: number) => Math.max(-1, Math.min(1, value))

function useInputCancellation(cancel: () => void) {
  useEffect(() => {
    const visibility = () => { if (document.visibilityState !== 'visible') cancel() }
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('blur', cancel)
      document.removeEventListener('visibilitychange', visibility)
      cancel()
    }
  }, [cancel])
}

function releaseCapture(pointer: { id: number; element: HTMLElement } | null) {
  if (pointer?.element.hasPointerCapture(pointer.id)) pointer.element.releasePointerCapture(pointer.id)
}

function AxisButton({ label, axis, value, hold }: { label: string; axis: Axis; value: number; hold: Hold }) {
  const pointer = useRef<{ id: number; element: HTMLButtonElement } | null>(null)
  const keyboard = useRef(false)
  const [pressed, setPressed] = useState(false)
  const release = useCallback(() => {
    const previous = pointer.current
    pointer.current = null
    keyboard.current = false
    hold(label, axis, 0)
    setPressed(false)
    releaseCapture(previous)
  }, [axis, hold, label])
  useInputCancellation(release)
  const end = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointer.current?.id !== event.pointerId) return
    const previous = pointer.current
    pointer.current = null
    hold(label, axis, keyboard.current ? value : 0)
    setPressed(keyboard.current)
    releaseCapture(previous)
  }
  return (
    <button
      className="touch-key"
      type="button"
      aria-label={`Hold to ${label.toLowerCase()}`}
      data-held={pressed}
      onPointerDown={(event) => {
        if (pointer.current || event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        pointer.current = { id: event.pointerId, element: event.currentTarget }
        event.currentTarget.setPointerCapture(event.pointerId)
        hold(label, axis, value)
        setPressed(true)
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyDown={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        keyboard.current = true
        hold(label, axis, value)
        setPressed(true)
      }}
      onKeyUp={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        keyboard.current = false
        hold(label, axis, pointer.current ? value : 0)
        setPressed(pointer.current !== null)
      }}
      onBlur={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      {label}
    </button>
  )
}

function Joystick({ onChange }: { onChange: (turn: number, vertical: number) => void }) {
  const pointer = useRef<{ id: number; element: HTMLDivElement } | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const release = useCallback(() => {
    const previous = pointer.current
    pointer.current = null
    onChange(0, 0)
    setPosition({ x: 0, y: 0 })
    releaseCapture(previous)
  }, [onChange])
  useInputCancellation(release)
  const update = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2 - 24)
    const dx = (event.clientX - rect.left - rect.width / 2) / radius
    const dy = (event.clientY - rect.top - rect.height / 2) / radius
    const length = Math.hypot(dx, dy)
    const magnitude = Math.min(1, length)
    const x = length ? dx / length * magnitude : 0
    const y = length ? dy / length * magnitude : 0
    // Radial deadzone with continuous re-scaling; diagonal movement never exceeds unit length.
    const strength = magnitude > 0.12 ? (magnitude - 0.12) / 0.88 / magnitude : 0
    onChange(x * strength, -y * strength)
    setPosition({ x: x * radius, y: y * radius })
  }
  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current?.id === event.pointerId) release()
  }
  return (
    <div className="touch-joystick" role="group" aria-label="Analog flight joystick: drag left or right to turn, up to climb, down to descend" onPointerDown={(event) => {
      if (pointer.current || event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      pointer.current = { id: event.pointerId, element: event.currentTarget }
      event.currentTarget.setPointerCapture(event.pointerId)
      update(event)
    }} onPointerMove={(event) => {
      if (pointer.current?.id !== event.pointerId) return
      event.preventDefault()
      update(event)
    }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onContextMenu={(event) => event.preventDefault()}>
      <span className="touch-joystick-label" aria-hidden="true">STEER / ALT</span>
      <span className="touch-joystick-knob" aria-hidden="true" style={{ transform: `translate(${position.x}px, ${position.y}px)` }} />
    </div>
  )
}

function CameraPad() {
  const hint = useId()
  const pointer = useRef<{ id: number; element: HTMLDivElement; x: number; y: number } | null>(null)
  const release = useCallback(() => {
    const previous = pointer.current
    pointer.current = null
    releaseCapture(previous)
  }, [])
  useInputCancellation(release)
  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current?.id === event.pointerId) release()
  }
  return (
    <div className="touch-camera-tools" role="group" aria-label="Camera controls">
      <div className="touch-camera-pad" role="group" tabIndex={0} aria-label="Camera look pad" aria-describedby={hint} onPointerDown={(event) => {
        if (pointer.current || event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        pointer.current = { id: event.pointerId, element: event.currentTarget, x: event.clientX, y: event.clientY }
        event.currentTarget.setPointerCapture(event.pointerId)
      }} onPointerMove={(event) => {
        const drag = pointer.current
        if (!drag || drag.id !== event.pointerId) return
        event.preventDefault()
        setCameraOffset({ yaw: cameraInput.yaw + (event.clientX - drag.x) * 0.006, pitch: cameraInput.pitch - (event.clientY - drag.y) * 0.006 })
        drag.x = event.clientX
        drag.y = event.clientY
      }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onBlur={release} onContextMenu={(event) => event.preventDefault()} onKeyDown={(event) => {
        const offsets: Record<string, { yaw?: number; pitch?: number; zoom?: number }> = {
          ArrowLeft: { yaw: cameraInput.yaw - 0.08 }, ArrowRight: { yaw: cameraInput.yaw + 0.08 },
          ArrowUp: { pitch: cameraInput.pitch + 0.05 }, ArrowDown: { pitch: cameraInput.pitch - 0.05 },
          '+': { zoom: cameraInput.zoom / 1.1 }, '=': { zoom: cameraInput.zoom / 1.1 }, '-': { zoom: cameraInput.zoom * 1.1 },
        }
        if (event.key === 'Home') { event.preventDefault(); event.stopPropagation(); resetCameraInput() }
        else if (offsets[event.key]) { event.preventDefault(); event.stopPropagation(); setCameraOffset(offsets[event.key]) }
      }}>
        <span aria-hidden="true">LOOK</span><small id={hint}>Drag to look · arrows / + / −</small>
      </div>
      <div className="touch-camera-buttons">
        <button className="touch-key" type="button" aria-label="Zoom camera in" onClick={() => setCameraOffset({ zoom: cameraInput.zoom / 1.15 })}>+</button>
        <button className="touch-key" type="button" aria-label="Zoom camera out" onClick={() => setCameraOffset({ zoom: cameraInput.zoom * 1.15 })}>−</button>
        <button className="touch-key" type="button" aria-label="Reset camera view" onClick={resetCameraInput}>Reset view</button>
      </div>
    </div>
  )
}

export function TouchControls() {
  const sources = useRef(new Map<string, { axis: Axis; value: number }>())
  const stick = useRef({ turn: 0, vertical: 0 })
  const update = useCallback(() => {
    const next = { throttle: 0, ...stick.current }
    sources.current.forEach(({ axis, value }) => { next[axis] += value })
    virtualInput.throttle = clamp(next.throttle)
    virtualInput.turn = clamp(next.turn)
    virtualInput.vertical = clamp(next.vertical)
  }, [])
  const hold = useCallback<Hold>((source, axis, value) => {
    if (value) sources.current.set(source, { axis, value })
    else sources.current.delete(source)
    update()
  }, [update])
  const setStick = useCallback((turn: number, vertical: number) => {
    stick.current = { turn, vertical }
    update()
  }, [update])
  const clear = useCallback(() => {
    sources.current.clear()
    stick.current = { turn: 0, vertical: 0 }
    Object.assign(virtualInput, { throttle: 0, turn: 0, vertical: 0 })
  }, [])
  useInputCancellation(clear)
  return (
    <div className="touch-controls" role="group" aria-label="Touch flight controls">
      <div className="touch-steering">
        <Joystick onChange={setStick} />
        <div className="touch-cluster touch-cluster--steer" role="group" aria-label="Button alternatives to joystick">
          <AxisButton label="Turn left" axis="turn" value={-1} hold={hold} />
          <AxisButton label="Turn right" axis="turn" value={1} hold={hold} />
          <AxisButton label="Climb" axis="vertical" value={1} hold={hold} />
          <AxisButton label="Descend" axis="vertical" value={-1} hold={hold} />
        </div>
      </div>
      <div className="touch-flight">
        <CameraPad />
        <div className="touch-cluster touch-cluster--flight" role="group" aria-label="Throttle controls">
          <AxisButton label="Accelerate" axis="throttle" value={1} hold={hold} />
          <AxisButton label="Brake" axis="throttle" value={-1} hold={hold} />
        </div>
      </div>
    </div>
  )
}

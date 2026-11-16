import { useEffect, useState } from 'react'
import { Gauge, Map, Pause, Play, RotateCcw, Settings2 } from 'lucide-react'
import { STATIONS, getStation, WORLD_BOUND } from '../config/stations'
import type { StationId } from '../config/stations'
import { MODEL_CONFIG } from '../config/models'
import { useIsTouch } from '../hooks/useDevice'
import { virtualInput } from '../hooks/useKeyboard'
import { compassDeg, flight, resetFlight } from '../lib/flight'
import type { CameraMode, QualityLevel } from '../stores/useExperienceStore'
import { useExperienceStore } from '../stores/useExperienceStore'
import { TouchControls } from './TouchControls'
import { Modal } from './Modal'
import { DestinationPanel } from './DestinationPanel'
import { AircraftLoadNotice } from './AircraftLoadNotice'
import { AudioControls } from './AudioControls'
import { AudioEngine } from '../audio/AudioEngine'
import { ACTIVE_AIRCRAFT, altitudeMeters, speedKmh } from '../config/aircraft'
import { effectState, EFFECTS_CONFIG } from '../lib/projectiles'
import { useEffects, resetEffects } from '../stores/useEffects'
import { clearSimulatorActions } from '../hooks/useSimulatorActions'
import { SimulatorTouchActions } from './SimulatorTouchActions'
import { sampleTerrainHeight } from '../lib/voxelTerrain'
import './simulator.css'
import './panels.css'

function resetAircraft() {
  resetFlight()
  clearSimulatorActions()
  resetEffects()
  Object.assign(virtualInput, { throttle: 0, turn: 0, vertical: 0 })
}
function telemetry() { return { speed: Math.round(speedKmh(flight.speed)), altitude: Math.round(altitudeMeters(flight.y)), agl: Math.round(altitudeMeters(Math.max(0, flight.y - sampleTerrainHeight(flight.x, flight.z)))), heading: Math.round(compassDeg(flight.heading)) % 360, throttle: Math.round(flight.throttle * 100), boost: flight.boosting, energy: Math.round(flight.boostEnergy * 100), boostCooldown: flight.boostCooldown, firing: effectState.firing, ammo: effectState.ammo, reload: effectState.reloadRemaining, cooldown: effectState.cooldown, shots: effectState.shotsFired, x: flight.x, z: flight.z } }

export function FlightInterface() {
  const [data, setData] = useState(telemetry)
  const [navOpen, setNavOpen] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [status, setStatus] = useState('Flight systems ready')
  const isTouch = useIsTouch()
  const effectsEnabled = useEffects((state) => state.enabled)
  const toggleEffects = useEffects((state) => state.toggle)
  const reloadEffects = useEffects((state) => state.reload)
  const paused = useExperienceStore((state) => state.paused)
  const flightMode = useExperienceStore((state) => state.flightMode)
  const cameraMode = useExperienceStore((state) => state.cameraMode)
  const nearby = useExperienceStore((state) => state.nearbyStation)
  const active = useExperienceStore((state) => state.activeStation)
  const settings = useExperienceStore((state) => state.settings)
  const setPaused = useExperienceStore((state) => state.setPaused)
  const toggleMode = useExperienceStore((state) => state.toggleFlightMode)
  const setCameraMode = useExperienceStore((state) => state.setCameraMode)
  const requestTeleport = useExperienceStore((state) => state.requestTeleport)
  const updateSettings = useExperienceStore((state) => state.updateSettings)
  const openStation = useExperienceStore((state) => state.openStation)

  useEffect(() => {
    const interval = window.setInterval(() => setData(telemetry()), 150)
    return () => window.clearInterval(interval)
  }, [])

  const closeNavigation = () => { setNavOpen(false); setPaused(false); setStatus('Flight resumed') }
  const toggleNavigation = () => { AudioEngine.uiClick(); const next = !navOpen; setNavOpen(next); setPaused(next); setStatus(next ? 'Navigation open — flight paused' : 'Flight resumed') }
  const inspect = (id: StationId) => { setNavOpen(false); setPaused(false); openStation(id); setStatus(`${getStation(id).name} information opened`) }
  const travel = (id: StationId) => { requestTeleport(id); closeNavigation(); setStatus(`Course set for ${getStation(id).name}`) }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.code === 'Escape') {
        if (useExperienceStore.getState().activeStation || navOpen || controlsOpen) return
        event.preventDefault()
        setNavOpen(true); setPaused(true)
        return
      }
      if (active || navOpen || controlsOpen) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName))) return
      if (event.code === 'Home') { event.preventDefault(); resetAircraft(); setStatus('Aircraft reset to the central meadow'); return }
      if (useExperienceStore.getState().paused) return
      if (event.code === 'KeyX') { toggleEffects(); setStatus(effectsEnabled ? 'Fictional effects disabled' : 'Fictional effects enabled — F fires, R reloads, Home resets'); return }
      if (event.code === 'Space') { event.preventDefault(); toggleMode() }
      else if (event.code === 'KeyR') {
        if (effectsEnabled) { reloadEffects(); setStatus('Fictional effect reload requested') }
        else { resetAircraft(); setStatus('Aircraft reset to the central meadow') }
      }
      else if (event.code === 'KeyF' && nearby && !effectsEnabled) { openStation(nearby); setStatus('Destination information opened') }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [active, controlsOpen, navOpen, nearby, openStation, setPaused, toggleMode, effectsEnabled, reloadEffects, toggleEffects])

  const togglePause = () => { setPaused(!paused); setStatus(paused ? 'Flight resumed' : 'Flight paused') }
  const closeControls = () => { setControlsOpen(false); setPaused(false) }
  const distance = (id: StationId) => { const p = getStation(id).pos; return Math.round(altitudeMeters(Math.hypot(p[0] - data.x, p[2] - data.z))) }
  const mapPosition = (v: number) => 50 + v / WORLD_BOUND * 45

  return (
    <div className="flight-ui">
      <a className="skip-link" href="#flight-controls">Skip to flight controls</a>
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">A//I</span><div><p>ANTI-AI</p><span>HUMAN INTELLIGENCE</span></div></div>
        <nav aria-label="Flight actions" className="topbar-actions">
          <button className="icon-button" type="button" onClick={togglePause} aria-label={paused ? 'Resume flight' : 'Pause flight'}>{paused ? <Play size={17} /> : <Pause size={17} />}<span>{paused ? 'Resume' : 'Pause'}</span></button>
          <button className="icon-button" type="button" onClick={toggleNavigation} aria-label="Open navigation" aria-expanded={navOpen}><Map size={17} /><span>Navigate</span></button>
          <button className="icon-button mobile-help" type="button" onClick={() => { setControlsOpen(true); setPaused(true) }} aria-label="Open flight controls"><Gauge size={17} /></button>
        </nav>
      </header>
      <aside className="telemetry-panel" aria-label="Aircraft telemetry"><div className="telemetry-row"><div><span>SPD</span><strong>{data.speed}</strong><small>KM/H</small></div><div><span>ALT</span><strong>{data.altitude}</strong><small>M</small></div><div><span>HDG</span><strong>{String(data.heading).padStart(3, '0')}°</strong><small>MAG</small></div></div><div className="mode-line"><span className="status-dot" />{ACTIVE_AIRCRAFT.name.toUpperCase()} // {flightMode.toUpperCase()} MODE · THR {data.throttle}%</div><div className="boost-line"><span>{data.boost ? 'BOOST ACTIVE' : data.boostCooldown > 0 ? 'BOOST COOLDOWN' : data.energy < 25 ? 'BOOST CHARGING' : 'BOOST READY'} · {data.energy}%</span><progress max={100} value={data.energy} aria-label="Boost energy" /><small>AGL {data.agl} M · world-datum altitude</small></div></aside>
      <aside className="effects-hud" aria-label="Fictional dual-wing effects">
        <header><strong>FICTIONAL FX // {effectsEnabled ? 'ARMED' : 'OFF'}</strong><button type="button" onClick={toggleEffects} aria-pressed={effectsEnabled}>X · {effectsEnabled ? 'Disable' : 'Enable'}</button></header>
        <div className="wing-indicators"><span data-firing={data.firing}>L WING {data.firing ? 'FIRING' : effectsEnabled ? 'READY' : 'OFF'}</span><span data-firing={data.firing}>R WING {data.firing ? 'FIRING' : effectsEnabled ? 'READY' : 'OFF'}</span></div>
        <p>AMMO {data.ammo}/{EFFECTS_CONFIG.ammo} · {data.reload > 0 ? `RELOAD ${data.reload.toFixed(1)}s` : data.cooldown > 0 ? 'CYCLING' : data.ammo < 2 ? 'EMPTY — RELOAD' : effectsEnabled ? 'READY' : 'DISABLED'}</p>
        <progress max={EFFECTS_CONFIG.reloadSeconds} value={data.reload > 0 ? EFFECTS_CONFIG.reloadSeconds - data.reload : EFFECTS_CONFIG.reloadSeconds} aria-label="Reload progress" />
        {effectsEnabled && <><button type="button" disabled={data.reload > 0 || data.ammo === EFFECTS_CONFIG.ammo} onClick={reloadEffects}>R · Reload</button><small>F / left mouse: fire · right drag: camera · Home: reset</small></>}
      </aside>
      <div className="camera-switcher" role="group" aria-label="Camera view">{(['follow', 'cine', 'station'] as CameraMode[]).map((mode) => <button key={mode} type="button" className={cameraMode === mode ? 'active' : ''} onClick={() => setCameraMode(mode)} aria-pressed={cameraMode === mode}>{mode === 'station' ? 'Overview' : mode}</button>)}</div>
      <section id="flight-controls" className="control-deck" aria-label="Flight controls"><button className="control-deck-toggle" type="button" onClick={() => { setControlsOpen(true); setPaused(true) }}><Gauge size={16} />Flight controls</button></section>
      <div className="quick-actions"><button className="round-action" type="button" onClick={() => { resetAircraft(); setStatus('Aircraft reset to the central meadow') }} aria-label="Reset aircraft"><RotateCcw size={17} /></button><button className="round-action" type="button" onClick={toggleMode} aria-label="Toggle flight or hover mode">{flightMode === 'flight' ? 'FLT' : 'HOV'}</button></div>
      {!active && !navOpen && nearby && <div className="proximity-card"><span>DESTINATION · {distance(nearby)} M</span><strong>{getStation(nearby).name}</strong><button className="btn-mil" type="button" onClick={() => inspect(nearby)}>{effectsEnabled ? 'Open information' : 'F · Open information'}</button><small>{MODEL_CONFIG[nearby].assetPath ? 'Configured model slot' : '3D asset awaiting upload'}</small></div>}
      {navOpen && <Modal title="WORLD DESTINATIONS" onClose={closeNavigation} className="navigation-dialog">
        <p className="nav-note">Travel to a site or read its information directly. Empty platforms are reserved for your actual 3D models.</p>
        <div className="world-map" role="img" aria-label="Destination map: north at top, aircraft and portfolio sites marked">
          <span className="map-north">N ↑</span><span className="map-aircraft" style={{ left: `${mapPosition(data.x)}%`, top: `${mapPosition(data.z)}%` }}>▲</span>
          {STATIONS.map((site) => <button type="button" key={site.id} className="map-site" style={{ left: `${mapPosition(site.pos[0])}%`, top: `${mapPosition(site.pos[2])}%` }} onClick={() => travel(site.id)} aria-label={`Travel to ${site.name}`}>{site.index}</button>)}
        </div>
        <div className="destination-rows">{STATIONS.map((site) => <div key={site.id} className="destination-row"><span className="eyebrow">{site.index}</span><div><strong>{site.name}</strong><small>{distance(site.id)} M · {MODEL_CONFIG[site.id].assetPath ? 'Asset configured' : 'Awaiting 3D model'}</small></div><button type="button" onClick={() => travel(site.id)} aria-label={`Fly to ${site.name}`}>Fly here</button><button type="button" onClick={() => inspect(site.id)} aria-label={`Read ${site.name}`}>Read</button></div>)}</div>
        <div className="quality-control"><Settings2 size={16} /><span>QUALITY</span>{(['low', 'medium', 'high'] as QualityLevel[]).map((quality) => <button key={quality} type="button" className={settings.quality === quality ? 'active' : ''} onClick={() => updateSettings({ quality })} aria-pressed={settings.quality === quality}>{quality}</button>)}</div>
        <label className="motion-setting"><input type="checkbox" checked={settings.reducedMotion} onChange={(event) => updateSettings({ reducedMotion: event.target.checked })} />Reduced motion</label>
      </Modal>}
      {controlsOpen && <Modal title="FLIGHT CONTROLS" onClose={closeControls}><div className="info-card"><p><kbd>W</kbd> / <kbd>↑</kbd> Accelerate · <kbd>S</kbd> / <kbd>↓</kbd> Brake</p><p><kbd>A</kbd> / <kbd>←</kbd> Left · <kbd>D</kbd> / <kbd>→</kbd> Right</p><p><kbd>Q</kbd> Descend · <kbd>E</kbd> Ascend</p><p><kbd>Space</kbd> Flight/hover · <kbd>R</kbd> Reset when FX is OFF</p><p><kbd>F</kbd> Nearby information when FX is OFF · <kbd>X</kbd> Toggle fictional FX</p><p>FX ON: <kbd>F</kbd>/left mouse fire · <kbd>R</kbd> Reload · right-drag camera</p><p><kbd>Shift</kbd> Boost · <kbd>Home</kbd> Always reset · <kbd>Esc</kbd> Navigation/back</p><button className="btn-mil" type="button" onClick={() => { resetAircraft(); closeControls() }}>Reset aircraft</button><button className="btn-mil" type="button" onClick={toggleMode}>Toggle flight/hover</button></div></Modal>}
      {paused && !navOpen && !controlsOpen && !active && <div className="pause-card" role="status"><span>FLIGHT PAUSED</span><button className="btn-mil primary" type="button" onClick={togglePause}>Resume flight</button></div>}
      {isTouch && !paused && !active && !navOpen && <><TouchControls /><SimulatorTouchActions /></>}
      <AudioControls />
      <AircraftLoadNotice />
      <DestinationPanel />
      <p className="sr-status" aria-live="polite">{status}</p>
    </div>
  )
}

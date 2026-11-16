import { useEffect, useId, useRef, useState } from 'react'
import { AudioEngine } from '../audio/AudioEngine'
import type { AudioChannel } from '../audio/AudioEngine'
import { useAudioSettings } from '../stores/useAudioSettings'
import './audio-controls.css'

const CHANNELS: { key: AudioChannel; label: string }[] = [
  { key: 'engine', label: 'Engine / boost' }, { key: 'wind', label: 'Wind' },
  { key: 'effects', label: 'Effects' }, { key: 'ui', label: 'Interface' },
]
export function AudioControls() {
  const settings = useAudioSettings()
  const [expanded, setExpanded] = useState(false)
  const [starting, setStarting] = useState(false)
  const [message, setMessage] = useState('Synthesized sounds. Starts only when you select ON.')
  const attempt = useRef(0)
  const panelId = useId()
  useEffect(() => {
    const sync = () => {
      const current = useAudioSettings.getState()
      AudioEngine.setMix(current)
      if (!current.audioEnabled && AudioEngine.running) AudioEngine.stop()
    }
    sync()
    const unsubscribeMix = useAudioSettings.subscribe(sync)
    const unsubscribeRunning = AudioEngine.subscribeRunning((running) => {
      if (!running) {
        useAudioSettings.getState().setAudioEnabled(false)
        setStarting(false)
        setMessage('Audio stopped. Select ON to enable synthesized sounds again.')
      }
    })
    const lifecycle = attempt
    return () => { ++lifecycle.current; unsubscribeMix(); unsubscribeRunning(); AudioEngine.stop(); useAudioSettings.getState().setAudioEnabled(false) }
  }, [])

  async function toggleAudio() {
    const id = ++attempt.current
    if (AudioEngine.running || starting) {
      AudioEngine.stop()
      settings.setAudioEnabled(false)
      setStarting(false)
      setMessage('Audio off. Volume choices are saved, but audio never starts automatically.')
      return
    }
    setStarting(true)
    AudioEngine.setMix(useAudioSettings.getState())
    AudioEngine.setMuted(false)
    // Do not move this into an effect, a frame callback, or behind an awaited operation.
    const started = await AudioEngine.start()
    if (id !== attempt.current) return
    setStarting(false)
    settings.setAudioEnabled(started)
    setMessage(started ? 'Synthesized flight, effects and interface sounds enabled.' : 'Audio could not start. Check browser audio permissions, then select ON to retry.')
    if (started) AudioEngine.uiClick()
  }
  const enabled = settings.audioEnabled && AudioEngine.running
  return (
    <section className="audio-controls" aria-label="Audio controls" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <div className="audio-controls__bar">
        <span className="audio-controls__label">SYNTH AUDIO</span>
        <button className="audio-controls__toggle" type="button" aria-pressed={enabled} aria-label={starting ? 'Cancel audio startup' : enabled ? 'Turn audio off' : 'Turn audio on'} onClick={() => { void toggleAudio() }}>
          {starting ? 'CANCEL' : enabled ? 'ON' : 'OFF'}
        </button>
        <button className="audio-controls__expand" type="button" aria-label="Audio volume settings" aria-controls={panelId} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          MIX
        </button>
      </div>
      {expanded && <div className="audio-controls__panel" id={panelId}>
        <label className="audio-controls__slider">
          <span>Master <output>{Math.round(settings.volume * 100)}%</output></span>
          <input type="range" min="0" max="1" step="0.01" value={settings.volume} aria-label="Master volume" onChange={(event) => settings.setVolume(Number(event.target.value))} />
        </label>
        {CHANNELS.map(({ key, label }) => <label className="audio-controls__slider" key={key}>
          <span>{label} <output>{Math.round(settings[`${key}Volume`] * 100)}%</output></span>
          <input type="range" min="0" max="1" step="0.01" value={settings[`${key}Volume`]} aria-label={`${label} volume`} onChange={(event) => settings.setChannelVolume(key, Number(event.target.value))} />
        </label>)}
        <p className="audio-controls__note">Procedural synth sounds, not authentic aircraft recordings. Paused flight is silent. Leaving the tab turns audio off.</p>
      </div>}
      <p className="audio-controls__status" role="status">{message}</p>
    </section>
  )
}

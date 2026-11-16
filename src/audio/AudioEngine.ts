import { METERS_PER_WORLD_UNIT } from '../config/aircraft'

export type AudioChannel = 'engine' | 'wind' | 'effects' | 'ui'
export interface AudioMix {
  volume: number
  engineVolume: number
  windVolume: number
  effectsVolume: number
  uiVolume: number
}
export type AudioPosition = { x: number; y: number; z: number } | readonly [number, number, number]
export interface FlightAudioFrame {
  speedNorm: number
  throttle: number
  boosting: boolean
  paused: boolean
  x: number
  y: number
  z: number
  heading: number
}
export interface AudioListenerFrame {
  x: number
  y: number
  z: number
  forwardX: number
  forwardY: number
  forwardZ: number
}
export const MAX_AUDIO_VOICES = 8
export const DEFAULT_AUDIO_MIX: Readonly<AudioMix> = Object.freeze({
  volume: 0.45, engineVolume: 0.8, windVolume: 0.6, effectsVolume: 0.65, uiVolume: 0.55,
})
export function clampAudioVolume(value: number, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
}
/** Bounded procedural mix, not a recording or an authentic aircraft simulation. */
export function audioGainPolicy(speedNorm: number, throttle: number, boosting = false, paused = false) {
  const speed = clampAudioVolume(speedNorm)
  const power = clampAudioVolume(throttle)
  return {
    engine: paused ? 0 : 0.024 + power * 0.075 + speed * 0.015 + (boosting ? 0.055 : 0),
    wind: paused ? 0 : speed * speed * 0.16,
    pitch: 46 + power * 55 + speed * 15 + (boosting ? 32 : 0),
    engineCutoff: 160 + power * 410 + (boosting ? 250 : 0),
    windCutoff: 350 + speed * 1500,
  }
}

interface Voice { source: AudioScheduledSourceNode; nodes: AudioNode[] }
const finite = (value: number) => Number.isFinite(value) ? value : 0
function coordinates(position: AudioPosition): [number, number, number] {
  const point = 'x' in position ? [position.x, position.y, position.z] : position
  return [finite(point[0]) * METERS_PER_WORLD_UNIT, finite(point[1]) * METERS_PER_WORLD_UNIT, finite(point[2]) * METERS_PER_WORLD_UNIT]
}

/** Private controller; importing this singleton never creates an AudioContext. */
class AudioEngineController {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buses: Partial<Record<AudioChannel, GainNode>> = {}
  private loops: AudioScheduledSourceNode[] = []
  private nodes: AudioNode[] = []
  private oscillators: OscillatorNode[] = []
  private engineGain: GainNode | null = null
  private engineFilter: BiquadFilterNode | null = null
  private enginePanner: PannerNode | null = null
  private windGain: GainNode | null = null
  private windFilter: BiquadFilterNode | null = null
  private noise: AudioBuffer | null = null
  private voices = new Set<Voice>()
  private mix: AudioMix = { ...DEFAULT_AUDIO_MIX }
  private muted = false
  private paused = false
  private ready = false
  private generation = 0
  private starting: Promise<boolean> | null = null
  private removeListeners: (() => void) | null = null
  private subscribers = new Set<(running: boolean) => void>()

  get running(): boolean { return this.ready && this.ctx?.state === 'running' }
  get isRunning(): boolean { return this.running }
  get activeVoiceCount(): number { return this.voices.size }
  subscribeRunning(callback: (running: boolean) => void): () => void {
    this.subscribers.add(callback)
    return () => { this.subscribers.delete(callback) }
  }
  private notify(): void { for (const callback of this.subscribers) callback(this.running) }

  /** Call synchronously inside the explicit Audio ON button gesture. Never from an effect/frame. */
  start(): Promise<boolean> {
    if (this.starting) return this.starting
    if (this.running) return Promise.resolve(true)
    if (typeof document !== 'undefined' && document.hidden) return Promise.resolve(false)
    if (this.ctx) this.stop()
    const Constructor = (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Constructor) return Promise.resolve(false)
    const generation = ++this.generation
    try {
      const ctx = new Constructor()
      this.ctx = ctx
      this.build(ctx)
      const onVisibility = () => { if (document.hidden) this.stop() }
      const onPageHide = () => this.stop()
      const onState = () => { if (this.ready && ctx.state !== 'running') this.stop() }
      ctx.addEventListener('statechange', onState)
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
      if (typeof window !== 'undefined') window.addEventListener('pagehide', onPageHide)
      this.removeListeners = () => {
        ctx.removeEventListener('statechange', onState)
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
        if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide)
      }
      // Resume is invoked before yielding so browser transient user activation is retained.
      const resumed = ctx.state === 'running' ? Promise.resolve() : ctx.resume()
      const pending = resumed.then(() => {
        if (this.generation !== generation || this.ctx !== ctx) return false
        if (ctx.state !== 'running' || (typeof document !== 'undefined' && document.hidden)) {
          this.stop()
          return false
        }
        this.ready = true
        this.applyMix()
        this.notify()
        return true
      }).catch(() => {
        if (this.generation === generation) this.stop()
        return false
      }).finally(() => {
        if (this.generation === generation) this.starting = null
      })
      this.starting = pending
      return pending
    } catch {
      this.stop()
      return Promise.resolve(false)
    }
  }

  private build(ctx: AudioContext): void {
    const gain = () => { const node = ctx.createGain(); this.nodes.push(node); return node }
    this.master = gain()
    this.master.gain.value = 0
    this.master.connect(ctx.destination)
    for (const channel of ['engine', 'wind', 'effects', 'ui'] as const) {
      this.buses[channel] = gain()
      this.buses[channel]!.connect(this.master)
    }
    this.engineGain = gain()
    this.engineGain.gain.value = 0
    this.engineFilter = ctx.createBiquadFilter()
    this.nodes.push(this.engineFilter)
    this.engineFilter.type = 'lowpass'
    this.engineFilter.Q.value = 0.7
    this.engineFilter.connect(this.engineGain)
    this.enginePanner = this.makePanner(ctx)
    this.nodes.push(this.enginePanner)
    this.engineGain.connect(this.enginePanner)
    this.enginePanner.connect(this.buses.engine!)
    for (const [ratio, type] of [[1, 'sawtooth'], [1.035, 'triangle'], [2, 'sine']] as const) {
      const source = ctx.createOscillator()
      this.loops.push(source)
      this.oscillators.push(source)
      source.type = type
      source.frequency.value = 46 * ratio
      source.connect(this.engineFilter)
      source.start()
    }
    this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2), ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1
    const source = ctx.createBufferSource()
    this.loops.push(source)
    source.buffer = this.noise
    source.loop = true
    this.windFilter = ctx.createBiquadFilter()
    this.nodes.push(this.windFilter)
    this.windFilter.type = 'bandpass'
    this.windFilter.Q.value = 0.5
    this.windGain = gain()
    this.windGain.gain.value = 0
    source.connect(this.windFilter)
    this.windFilter.connect(this.windGain)
    this.windGain.connect(this.buses.wind!)
    source.start()
  }

  private makePanner(ctx: AudioContext): PannerNode {
    const panner = ctx.createPanner()
    panner.panningModel = 'equalpower'
    panner.distanceModel = 'inverse'
    panner.refDistance = 30
    panner.maxDistance = 2000
    panner.rolloffFactor = 0.35
    return panner
  }
  private smooth(parameter: AudioParam, value: number, seconds = 0.09): void {
    if (this.ctx) parameter.setTargetAtTime(value, this.ctx.currentTime, seconds)
  }
  private place(panner: PannerNode, position: AudioPosition): void {
    const [x, y, z] = coordinates(position)
    if (panner.positionX) {
      this.smooth(panner.positionX, x, 0.035)
      this.smooth(panner.positionY, y, 0.035)
      this.smooth(panner.positionZ, z, 0.035)
    } else panner.setPosition(x, y, z)
  }
  /** Positions use world units. Optional listener is the current camera, with a unit forward vector. */
  update(frame: FlightAudioFrame | number, listener?: AudioListenerFrame): void {
    if (!this.running || !this.ctx) return
    const state: FlightAudioFrame = typeof frame === 'number'
      ? { speedNorm: frame, throttle: frame, boosting: false, paused: false, x: 0, y: 0, z: 0, heading: 0 }
      : frame
    this.setPaused(state.paused)
    const policy = audioGainPolicy(state.speedNorm, state.throttle, state.boosting, this.paused)
    this.smooth(this.engineGain!.gain, policy.engine, 0.12)
    this.smooth(this.engineFilter!.frequency, policy.engineCutoff, 0.15)
    this.smooth(this.windGain!.gain, policy.wind, 0.2)
    this.smooth(this.windFilter!.frequency, policy.windCutoff, 0.2)
    this.oscillators.forEach((oscillator, index) => this.smooth(oscillator.frequency, policy.pitch * [1, 1.035, 2][index], 0.15))
    this.place(this.enginePanner!, state)
    const ear = listener ?? { x: state.x, y: state.y, z: state.z, forwardX: Math.sin(finite(state.heading)), forwardY: 0, forwardZ: -Math.cos(finite(state.heading)) }
    const [x, y, z] = coordinates(ear)
    const audioListener = this.ctx.listener
    const fx = finite(ear.forwardX), fy = finite(ear.forwardY), fz = finite(ear.forwardZ)
    if (audioListener.positionX) {
      this.smooth(audioListener.positionX, x, 0.035)
      this.smooth(audioListener.positionY, y, 0.035)
      this.smooth(audioListener.positionZ, z, 0.035)
      this.smooth(audioListener.forwardX, fx, 0.035)
      this.smooth(audioListener.forwardY, fy, 0.035)
      this.smooth(audioListener.forwardZ, fz, 0.035)
      this.smooth(audioListener.upX, 0, 0.035)
      this.smooth(audioListener.upY, 1, 0.035)
      this.smooth(audioListener.upZ, 0, 0.035)
    } else {
      audioListener.setPosition(x, y, z)
      audioListener.setOrientation(fx, fy, fz, 0, 1, 0)
    }
  }

  setMix(patch: Partial<AudioMix>): void {
    for (const key of Object.keys(DEFAULT_AUDIO_MIX) as (keyof AudioMix)[]) {
      if (patch[key] !== undefined) this.mix[key] = clampAudioVolume(patch[key], DEFAULT_AUDIO_MIX[key])
    }
    this.applyMix()
  }
  setVolume(volume: number): void { this.setMix({ volume }) }
  setChannelVolume(channel: AudioChannel, volume: number): void { this.setMix({ [`${channel}Volume`]: volume }) }
  setMuted(muted: boolean): void { this.muted = muted; this.applyMix(); if (muted) this.clearVoices() }
  setPaused(paused: boolean): void {
    if (this.paused === paused) return
    this.paused = paused
    if (paused) this.clearVoices()
    this.applyMix(paused)
  }
  /** Legacy controls only change gain; they never resume a suspended browser context. */
  suspend(): void { this.setPaused(true) }
  resume(): void { this.setPaused(false) }
  private applyMix(immediateSilence = false): void {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    const masterVolume = this.muted || this.paused || !this.ready ? 0 : this.mix.volume
    this.master.gain.cancelScheduledValues(now)
    if (immediateSilence || !this.ready) this.master.gain.setValueAtTime(masterVolume, now)
    else this.master.gain.setTargetAtTime(masterVolume, now, 0.025)
    for (const channel of ['engine', 'wind', 'effects', 'ui'] as const) {
      this.smooth(this.buses[channel]!.gain, this.mix[`${channel}Volume`], 0.025)
    }
  }
  private releaseVoice(voice: Voice, stop = true): void {
    if (!this.voices.delete(voice)) return
    voice.source.onended = null
    if (stop) { try { voice.source.stop() } catch { /* Already ended. */ } }
    for (const node of voice.nodes) node.disconnect()
  }
  private clearVoices(): void { for (const voice of [...this.voices]) this.releaseVoice(voice) }

  private oneShot(channel: AudioChannel, from: number, to: number, duration: number, peak: number, type: OscillatorType | 'noise', position?: AudioPosition): void {
    if (!this.running || !this.ctx || this.paused || this.muted || this.mix.volume === 0 || this.mix[`${channel}Volume`] === 0) return
    while (this.voices.size >= MAX_AUDIO_VOICES) this.releaseVoice(this.voices.values().next().value!)
    const ctx = this.ctx
    const nodes: AudioNode[] = []
    let voice: Voice | null = null
    try {
      const source = type === 'noise' ? ctx.createBufferSource() : ctx.createOscillator()
      nodes.push(source)
      voice = { source, nodes }
      this.voices.add(voice)
      const gain = ctx.createGain()
      nodes.push(gain)
      const now = ctx.currentTime
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(peak, now + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      if (type === 'noise') {
        const noiseSource = source as AudioBufferSourceNode
        noiseSource.buffer = this.noise
        const filter = ctx.createBiquadFilter()
        nodes.push(filter)
        filter.type = 'lowpass'
        filter.Q.value = 0.5
        filter.frequency.setValueAtTime(from, now)
        filter.frequency.exponentialRampToValueAtTime(to, now + duration)
        source.connect(filter)
        filter.connect(gain)
      } else {
        const oscillator = source as OscillatorNode
        oscillator.type = type
        oscillator.frequency.setValueAtTime(from, now)
        oscillator.frequency.exponentialRampToValueAtTime(to, now + duration)
        source.connect(gain)
      }
      if (position) {
        const panner = this.makePanner(ctx)
        nodes.push(panner)
        const [x, y, z] = coordinates(position)
        panner.setPosition(x, y, z)
        gain.connect(panner)
        panner.connect(this.buses[channel]!)
      } else gain.connect(this.buses[channel]!)
      const ownedVoice = voice
      source.onended = () => this.releaseVoice(ownedVoice, false)
      source.start(now)
      source.stop(now + duration + 0.02)
    } catch {
      if (voice) this.releaseVoice(voice)
      else for (const node of nodes) node.disconnect()
    }
  }
  /** Call once per new projectile/effect event, never for every rendered projectile frame. */
  fire(position?: AudioPosition): void { this.oneShot('effects', 2600, 450, 0.1, 0.24, 'noise', position) }
  impact(position?: AudioPosition, intensity = 1): void { this.oneShot('effects', 700, 90, 0.38, 0.12 + clampAudioVolume(intensity) * 0.2, 'noise', position) }
  takeoff(position?: AudioPosition): void { this.oneShot('effects', 90, 240, 0.42, 0.09, 'triangle', position) }
  landing(position?: AudioPosition): void { this.oneShot('effects', 420, 65, 0.3, 0.2, 'noise', position) }
  uiClick(): void { this.oneShot('ui', 920, 800, 0.055, 0.065, 'sine') }
  uiHover(): void { this.oneShot('ui', 1400, 1400, 0.03, 0.025, 'sine') }
  uiOpen(): void { this.oneShot('ui', 340, 680, 0.18, 0.065, 'triangle') }
  uiClose(): void { this.oneShot('ui', 680, 340, 0.15, 0.065, 'triangle') }
  stationPing(): void { this.oneShot('ui', 520, 780, 0.35, 0.08, 'sine') }
  teleportWhoosh(): void { this.oneShot('effects', 1400, 170, 0.42, 0.15, 'noise') }
  shawarmaNom(): void { this.oneShot('ui', 660, 220, 0.4, 0.09, 'triangle') }

  /** Immediate source teardown; any pending start is invalidated. Safe to call repeatedly. */
  stop(): void {
    ++this.generation
    this.ready = false
    this.starting = null
    this.removeListeners?.()
    this.removeListeners = null
    this.clearVoices()
    const ctx = this.ctx
    if (ctx && this.master) {
      this.master.gain.cancelScheduledValues(ctx.currentTime)
      this.master.gain.setValueAtTime(0, ctx.currentTime)
    }
    for (const source of this.loops) {
      try { source.stop() } catch { /* Already stopped. */ }
      source.disconnect()
    }
    for (const node of this.nodes) node.disconnect()
    this.loops = []
    this.nodes = []
    this.oscillators = []
    this.buses = {}
    this.master = this.engineGain = this.windGain = null
    this.engineFilter = this.windFilter = null
    this.enginePanner = null
    this.noise = null
    this.ctx = null
    if (ctx && ctx.state !== 'closed') { try { void ctx.close().catch(() => {}) } catch { /* Context already closed. */ } }
    this.notify()
  }
  dispose(): void { this.stop() }
}

export const AudioEngine = new AudioEngineController()

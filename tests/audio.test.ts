import assert from 'node:assert/strict'
import test from 'node:test'
import { AudioEngine, audioGainPolicy, clampAudioVolume, DEFAULT_AUDIO_MIX, MAX_AUDIO_VOICES } from '../src/audio/AudioEngine'
import { sanitizeAudioSettings, useAudioSettings } from '../src/stores/useAudioSettings'

class Parameter {
  value = 0
  setValueAtTime(value: number) { this.value = value }
  setTargetAtTime(value: number) { this.value = value }
  linearRampToValueAtTime(value: number) { this.value = value }
  exponentialRampToValueAtTime(value: number) { this.value = value }
  cancelScheduledValues() {}
}
class Node {
  gain = new Parameter()
  frequency = new Parameter()
  Q = new Parameter()
  positionX = new Parameter(); positionY = new Parameter(); positionZ = new Parameter()
  forwardX = new Parameter(); forwardY = new Parameter(); forwardZ = new Parameter()
  upX = new Parameter(); upY = new Parameter(); upZ = new Parameter()
  type = ''; panningModel = ''; distanceModel = ''; refDistance = 0; maxDistance = 0; rolloffFactor = 0
  buffer: unknown = null
  loop = false
  disconnected = false
  started = false
  stopped = false
  onended: (() => void) | null = null
  connect(_target: unknown) {}
  disconnect() { this.disconnected = true }
  start() { this.started = true }
  stop() { this.stopped = true }
  setPosition(x: number, y: number, z: number) { this.positionX.value = x; this.positionY.value = y; this.positionZ.value = z }
  setOrientation() {}
  finish() { this.onended?.() }
}
class FakeContext {
  static instances: FakeContext[] = []
  static rejectResume = false
  static deferResume = false
  state = 'suspended'
  sampleRate = 1000
  currentTime = 1
  destination = new Node()
  listener = new Node()
  nodes: Node[] = []
  sources: Node[] = []
  listeners = new Set<() => void>()
  closeCalls = 0
  resumeCalls = 0
  releaseResume: (() => void) | null = null
  constructor() { FakeContext.instances.push(this) }
  createGain() { return this.node() }
  createBiquadFilter() { return this.node() }
  createPanner() { return this.node() }
  private node() { const node = new Node(); this.nodes.push(node); return node }
  createOscillator() { const node = this.node(); this.sources.push(node); return node }
  createBufferSource() { const node = this.node(); this.sources.push(node); return node }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) } }
  resume() {
    this.resumeCalls++
    if (FakeContext.rejectResume) return Promise.reject(new Error('Autoplay blocked'))
    if (FakeContext.deferResume) return new Promise<void>((resolve) => { this.releaseResume = () => { this.state = 'running'; resolve() } })
    this.state = 'running'
    return Promise.resolve()
  }
  close() { this.closeCalls++; this.state = 'closed'; return Promise.resolve() }
  addEventListener(_event: string, callback: () => void) { this.listeners.add(callback) }
  removeEventListener(_event: string, callback: () => void) { this.listeners.delete(callback) }
  suspendExternally() { this.state = 'suspended'; for (const callback of [...this.listeners]) callback() }
}
class FakeDocument {
  hidden = false
  listeners = new Set<() => void>()
  addEventListener(_event: string, callback: () => void) { this.listeners.add(callback) }
  removeEventListener(_event: string, callback: () => void) { this.listeners.delete(callback) }
  hide() { this.hidden = true; for (const callback of [...this.listeners]) callback() }
}
const root = globalThis as unknown as Record<string, unknown>
async function fakeAudio(run: (context: () => FakeContext, document: FakeDocument) => Promise<void>) {
  const contextDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const document = new FakeDocument()
  root.AudioContext = FakeContext
  root.document = document
  FakeContext.instances = []; FakeContext.rejectResume = false; FakeContext.deferResume = false
  AudioEngine.dispose(); AudioEngine.setMix(DEFAULT_AUDIO_MIX); AudioEngine.setMuted(false); AudioEngine.setPaused(false)
  try { await run(() => FakeContext.instances.at(-1)!, document) }
  finally {
    AudioEngine.dispose()
    if (contextDescriptor) Object.defineProperty(globalThis, 'AudioContext', contextDescriptor)
    else delete root.AudioContext
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor)
    else delete root.document
  }
}
const frame = { speedNorm: 0.6, throttle: 0.8, boosting: false, paused: false, x: 1, y: 2, z: 3, heading: 0 }

test('gain policy clamps hostile input and boost changes only the engine policy', () => {
  assert.equal(clampAudioVolume(Infinity), 0)
  assert.equal(clampAudioVolume(NaN, 0.45), 0.45)
  assert.equal(clampAudioVolume(-1), 0)
  assert.equal(clampAudioVolume(9), 1)
  const cruise = audioGainPolicy(0.6, 0.8)
  const boost = audioGainPolicy(0.6, 0.8, true)
  assert.ok(boost.engine > cruise.engine && boost.pitch > cruise.pitch)
  assert.equal(boost.wind, cruise.wind)
  assert.equal(audioGainPolicy(9, 9, true).engine, audioGainPolicy(1, 1, true).engine)
  assert.equal(audioGainPolicy(0, 0).wind, 0)
  assert.equal(audioGainPolicy(1, 1, true, true).engine, 0)
  assert.equal(audioGainPolicy(1, 1, true, true).wind, 0)
})
test('persisted data restores safe volumes but never audio consent', () => {
  assert.deepEqual(sanitizeAudioSettings(null), { ...DEFAULT_AUDIO_MIX, audioEnabled: false })
  const settings = sanitizeAudioSettings({ audioEnabled: true, volume: Infinity, engineVolume: -4, windVolume: 12, effectsVolume: 'loud', uiVolume: 0.2 })
  assert.equal(settings.audioEnabled, false)
  assert.equal(settings.volume, 0.45)
  assert.equal(settings.engineVolume, 0)
  assert.equal(settings.windVolume, 1)
  assert.equal(settings.effectsVolume, DEFAULT_AUDIO_MIX.effectsVolume)
  assert.equal(settings.uiVolume, 0.2)
  useAudioSettings.getState().setChannelVolume('wind', 0.12)
  assert.equal(useAudioSettings.getState().engineVolume, DEFAULT_AUDIO_MIX.engineVolume)
  assert.equal(useAudioSettings.getState().windVolume, 0.12)
  assert.equal(useAudioSettings.persist.getOptions().name, 'anti-ai-audio')
  const persisted = useAudioSettings.persist.getOptions().partialize!(useAudioSettings.getState()) as { audioEnabled: boolean }
  assert.equal(persisted.audioEnabled, false)
})
test('no context exists on import and unavailable WebAudio stays silent', async () => {
  assert.equal(AudioEngine.running, false)
  if (typeof AudioContext === 'undefined') assert.equal(await AudioEngine.start(), false)
  AudioEngine.uiOpen(); AudioEngine.fire(); AudioEngine.update(frame)
  assert.equal(AudioEngine.activeVoiceCount, 0)
})
test('repeated start builds one bounded loop graph and teardown disconnects everything', async () => {
  await fakeAudio(async (context) => {
    const [first, second] = await Promise.all([AudioEngine.start(), AudioEngine.start()])
    assert.equal(first, true); assert.equal(second, true)
    assert.equal(FakeContext.instances.length, 1)
    assert.equal(context().sources.length, 4)
    assert.equal(context().resumeCalls, 1)
    AudioEngine.update(frame)
    AudioEngine.fire([1, 2, 3]); AudioEngine.uiOpen()
    assert.equal(AudioEngine.activeVoiceCount, 2)
    AudioEngine.stop(); AudioEngine.stop()
    assert.equal(AudioEngine.running, false)
    assert.equal(AudioEngine.activeVoiceCount, 0)
    assert.equal(context().closeCalls, 1)
    assert.ok(context().sources.every((source) => source.stopped && source.disconnected))
    assert.ok(context().nodes.every((node) => node.disconnected))
    assert.equal(context().listeners.size, 0)
    assert.equal(await AudioEngine.start(), true)
    assert.equal(FakeContext.instances.length, 2)
  })
})
test('fire, impact and UI voices share a cap and onended releases every node', async () => {
  await fakeAudio(async (context) => {
    await AudioEngine.start()
    for (let index = 0; index < 40; index++) {
      AudioEngine.fire(frame); AudioEngine.impact(frame); AudioEngine.uiClick()
      assert.ok(AudioEngine.activeVoiceCount <= MAX_AUDIO_VOICES)
    }
    assert.equal(AudioEngine.activeVoiceCount, 8)
    const shots = context().sources.slice(4)
    assert.ok(shots.slice(0, -8).every((source) => source.disconnected))
    for (const source of shots) source.finish()
    assert.equal(AudioEngine.activeVoiceCount, 0)
    assert.ok(shots.every((source) => source.disconnected))
  })
})
test('channel sliders are independent, zero gain suppresses one-shots and pause is immediate', async () => {
  await fakeAudio(async (context) => {
    await AudioEngine.start()
    AudioEngine.setChannelVolume('wind', 0.13)
    // Graph order: master, engine, wind, effects, interface.
    assert.equal(context().nodes[2].gain.value, 0.13)
    assert.equal(context().nodes[1].gain.value, DEFAULT_AUDIO_MIX.engineVolume)
    AudioEngine.fire()
    AudioEngine.update({ ...frame, paused: true })
    assert.equal(context().nodes[0].gain.value, 0)
    assert.equal(AudioEngine.activeVoiceCount, 0)
    AudioEngine.fire(); AudioEngine.uiClick()
    assert.equal(AudioEngine.activeVoiceCount, 0)
    AudioEngine.update(frame)
    assert.equal(context().resumeCalls, 1)
    AudioEngine.setChannelVolume('effects', 0)
    AudioEngine.fire(); AudioEngine.impact()
    assert.equal(AudioEngine.activeVoiceCount, 0)
    AudioEngine.uiClick()
    assert.equal(AudioEngine.activeVoiceCount, 1)
    AudioEngine.setMuted(true)
    assert.equal(AudioEngine.activeVoiceCount, 0)
  })
})
test('autoplay rejection cleans up and OFF invalidates an in-flight start', async () => {
  await fakeAudio(async (context) => {
    FakeContext.rejectResume = true
    assert.equal(await AudioEngine.start(), false)
    assert.equal(AudioEngine.running, false)
    assert.equal(context().closeCalls, 1)
    FakeContext.rejectResume = false; FakeContext.deferResume = true
    const pending = AudioEngine.start()
    const interrupted = context()
    AudioEngine.stop()
    interrupted.releaseResume!()
    assert.equal(await pending, false)
    assert.equal(AudioEngine.running, false)
    assert.ok(interrupted.sources.every((source) => source.disconnected))
  })
})
test('hidden tabs and external browser suspension stop audio without unsolicited resume', async () => {
  await fakeAudio(async (context, document) => {
    await AudioEngine.start()
    document.hide()
    assert.equal(AudioEngine.running, false)
    assert.equal(document.listeners.size, 0)
    assert.equal(context().closeCalls, 1)
    assert.equal(await AudioEngine.start(), false)
    document.hidden = false
    AudioEngine.resume(); AudioEngine.update(frame)
    assert.equal(AudioEngine.running, false)
    assert.equal(FakeContext.instances.length, 1)
    await AudioEngine.start()
    context().suspendExternally()
    assert.equal(AudioEngine.running, false)
    assert.equal(context().closeCalls, 1)
    assert.equal(context().listeners.size, 0)
  })
})

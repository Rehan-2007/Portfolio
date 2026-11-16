import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import { clampAudioVolume, DEFAULT_AUDIO_MIX } from '../audio/AudioEngine'
import type { AudioChannel, AudioMix } from '../audio/AudioEngine'

export interface AudioSettings extends AudioMix { audioEnabled: boolean }
interface AudioSettingsState extends AudioSettings {
  setAudioEnabled: (enabled: boolean) => void
  setVolume: (volume: number) => void
  setChannelVolume: (channel: AudioChannel, volume: number) => void
}
export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = Object.freeze({ ...DEFAULT_AUDIO_MIX, audioEnabled: false })
/** Hydration never restores consent: each page load requires the explicit ON gesture. */
export function sanitizeAudioSettings(value: unknown): AudioSettings {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const result: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS }
  for (const key of Object.keys(DEFAULT_AUDIO_MIX) as (keyof AudioMix)[]) {
    result[key] = typeof input[key] === 'number' ? clampAudioVolume(input[key], DEFAULT_AUDIO_MIX[key]) : DEFAULT_AUDIO_MIX[key]
  }
  result.audioEnabled = false
  return result
}
const storage: StateStorage = {
  getItem: (name) => { try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(name) } catch { return null } },
  setItem: (name, value) => { try { if (typeof localStorage !== 'undefined') localStorage.setItem(name, value) } catch { /* Storage can be disabled or full. */ } },
  removeItem: (name) => { try { if (typeof localStorage !== 'undefined') localStorage.removeItem(name) } catch { /* Optional persistence. */ } },
}
export const useAudioSettings = create<AudioSettingsState>()(persist((set) => ({
  ...DEFAULT_AUDIO_SETTINGS,
  setAudioEnabled: (audioEnabled) => set({ audioEnabled }),
  setVolume: (volume) => set({ volume: clampAudioVolume(volume, DEFAULT_AUDIO_MIX.volume) }),
  setChannelVolume: (channel, volume) => set({ [`${channel}Volume`]: clampAudioVolume(volume, DEFAULT_AUDIO_MIX[`${channel}Volume`]) }),
}), {
  name: 'anti-ai-audio',
  version: 1,
  storage: createJSONStorage(() => storage),
  partialize: (state) => ({ ...sanitizeAudioSettings(state) }),
  migrate: (persisted) => sanitizeAudioSettings(persisted),
  merge: (persisted, current) => ({ ...current, ...sanitizeAudioSettings(persisted) }),
}))

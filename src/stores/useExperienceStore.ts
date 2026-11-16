import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StationId } from '../config/stations'

/* ── Types ─────────────────────────────────────────────────────── */
export type Phase = 'boot' | 'loading' | 'intro' | 'choice' | 'flying'
export type QualityLevel = 'low' | 'medium' | 'high'
export type FlightMode = 'flight' | 'hover'
export type CameraMode = 'cine' | 'follow' | 'station'

export interface Settings {
  quality: QualityLevel
  audioVolume: number // 0..1
  audioMuted: boolean
  reducedMotion: boolean
}

interface ExperienceState {
  /* Flow */
  phase: Phase
  loadingProgress: number // 0..1
  sceneReady: boolean
  introCard: number // which intro title card is showing
  introDone: boolean

  /* Stations */
  activeStation: StationId | null
  nearbyStation: StationId | null
  hoveredStation: StationId | null
  /** station the camera should focus on (set when a station opens) */
  cameraMode: CameraMode
  previousCameraMode: CameraMode
  /** pending teleport target from the nav menu */
  teleportTarget: StationId | null

  /* Flight */
  flightMode: FlightMode
  paused: boolean
  uiOpen: boolean // any blocking UI (menu / panel / pause) is open

  /* Settings (persisted) */
  settings: Settings

  /* Actions */
  setPhase: (p: Phase) => void
  setLoadingProgress: (v: number) => void
  markSceneReady: () => void
  setIntroCard: (n: number) => void
  finishIntro: () => void

  openStation: (id: StationId) => void
  closeStation: () => void
  setNearby: (id: StationId | null) => void
  setHovered: (id: StationId | null) => void
  requestTeleport: (id: StationId) => void
  clearTeleport: () => void

  setFlightMode: (m: FlightMode) => void
  toggleFlightMode: () => void
  setCameraMode: (m: CameraMode) => void
  setPaused: (v: boolean) => void
  setUiOpen: (v: boolean) => void

  updateSettings: (patch: Partial<Settings>) => void
}

/* ── Defaults ──────────────────────────────────────────────────── */
function defaultQuality(): Settings['quality'] {
  if (typeof window === 'undefined') return 'medium'
  const isMobile =
    window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768
  return isMobile ? 'low' : 'high'
}

function defaultReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* ── Store ─────────────────────────────────────────────────────── */
export const useExperienceStore = create<ExperienceState>()(
  persist(
    (set) => ({
      phase: 'boot',
      loadingProgress: 0,
      sceneReady: false,
      introCard: 0,
      introDone: false,

      activeStation: null,
      nearbyStation: null,
      hoveredStation: null,
      cameraMode: 'cine',
      previousCameraMode: 'cine',
      teleportTarget: null,

      flightMode: 'flight',
      paused: false,
      uiOpen: false,

      settings: {
        quality: defaultQuality(),
        audioVolume: 0.7,
        audioMuted: false,
        reducedMotion: defaultReducedMotion(),
      },

      setPhase: (phase) => set({ phase }),
      setLoadingProgress: (loadingProgress) => set({ loadingProgress }),
      markSceneReady: () => set({ sceneReady: true }),
      setIntroCard: (introCard) => set({ introCard }),
      finishIntro: () => set({ introDone: true }),

      openStation: (id) =>
        set((state) => ({
          activeStation: id,
          previousCameraMode: state.activeStation ? state.previousCameraMode : state.cameraMode,
          cameraMode: 'station',
          uiOpen: true,
        })),
      closeStation: () =>
        set((state) => ({ activeStation: null, cameraMode: state.previousCameraMode, uiOpen: state.paused })),
      setNearby: (nearbyStation) => set({ nearbyStation }),
      setHovered: (hoveredStation) => set({ hoveredStation }),
      requestTeleport: (id) => set({ teleportTarget: id }),
      clearTeleport: () => set({ teleportTarget: null }),

      setFlightMode: (flightMode) => set({ flightMode }),
      toggleFlightMode: () =>
        set((s) => ({ flightMode: s.flightMode === 'flight' ? 'hover' : 'flight' })),
      setCameraMode: (cameraMode) => set({ cameraMode }),
      setPaused: (paused) => set((state) => ({ paused, uiOpen: paused || state.activeStation !== null })),
      setUiOpen: (uiOpen) => set({ uiOpen }),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'anti-ai-settings',
      partialize: (s) => ({ settings: s.settings }),
    },
  ),
)

/** Non-reactive read helper for use inside useFrame */
export const experienceSnapshot = useExperienceStore.getState

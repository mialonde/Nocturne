import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { clampBeat, clampCarrier, DEFAULT_BREATH_PATTERN } from '../config/audio'
import { createStarterSession } from '../config/sessions'
import { isThemeId } from '../config/themes'
import { isLanguageCode } from '../language/types'
import { translate } from '../language'
import type { LanguageCode } from '../language'
import type {
  AudioSettings,
  AudioStatus,
  BreathPattern,
  ExperienceMode,
  FullscreenShortcut,
  MicStatus,
  PanelId,
  RecordingSettings,
  SavedSession,
  SessionPlaybackState,
  SleepTimerState,
  SoundscapeProfileId,
  ThemeId,
  ToastMessage,
  VisualSettings,
} from '../types'
import type { AmbienceCategory, AmbienceMix, AmbienceSoundId } from '../config/ambience'
import { AMBIENCE_SOUNDS } from '../config/ambience'

const initialPlayback: SessionPlaybackState = {
  status: 'idle',
  sessionId: null,
  sessionName: '',
  segmentIndex: 0,
  segmentLabel: '',
  elapsedMs: 0,
  segmentElapsedMs: 0,
  totalMs: 0,
  transitionSec: 0,
}

const idlePlayback = (): SessionPlaybackState => ({ ...initialPlayback })

const idleSleepTimer = (): SleepTimerState => ({
  endsAt: null,
  minutes: null,
  remainingMs: 0,
})

function sanitizeTrackVolumes(
  value: unknown,
): Partial<Record<AmbienceSoundId, number>> {
  if (!value || typeof value !== 'object') return {}
  const sanitized: Partial<Record<AmbienceSoundId, number>> = {}
  for (const [id, volume] of Object.entries(value)) {
    if (!(id in AMBIENCE_SOUNDS)) continue
    if (typeof volume !== 'number' || !Number.isFinite(volume)) continue
    const clamped = Math.max(0, Math.min(1, volume))
    if (clamped > 0.001) sanitized[id as AmbienceSoundId] = clamped
  }
  return sanitized
}

export interface NocturneState {
  language: LanguageCode
  theme: ThemeId
  ambientProfile: SoundscapeProfileId
  experienceStarted: boolean
  mode: ExperienceMode
  audioStatus: AudioStatus
  micStatus: MicStatus
  micError: string | null
  activePanel: PanelId | null
  isUiHidden: boolean
  contextLost: boolean
  toast: ToastMessage | null
  audio: AudioSettings
  breathPattern: BreathPattern
  breathRunning: boolean
  breathCues: boolean
  visuals: VisualSettings
  recording: RecordingSettings
  sessions: SavedSession[]
  sessionPlayback: SessionPlaybackState
  sleepTimer: SleepTimerState
  fullscreenShortcut: FullscreenShortcut
  ambienceTrackVolumes: Partial<Record<AmbienceSoundId, number>>
  ambienceFavorites: AmbienceSoundId[]
  userMixes: AmbienceMix[]
  activeMixId: string | null
  ambienceCategoryFilter: AmbienceCategory | 'all' | 'favorites'
  ambienceSearchQuery: string

  setLanguage: (language: LanguageCode) => void
  setTheme: (theme: ThemeId) => void
  setAmbientProfile: (profile: SoundscapeProfileId) => void
  setMode: (mode: ExperienceMode) => void
  setExperienceStarted: (started: boolean) => void
  setAudioStatus: (status: AudioStatus) => void
  setMicStatus: (status: MicStatus, error?: string | null) => void
  setPanel: (panel: PanelId | null) => void
  togglePanel: (panel: PanelId) => void
  setUiHidden: (hidden: boolean) => void
  setContextLost: (lost: boolean) => void
  showToast: (message: string, tone?: ToastMessage['tone']) => void
  clearToast: () => void
  updateAudio: (patch: Partial<AudioSettings>) => void
  updateAmbientLayers: (patch: Partial<AudioSettings['layers']>) => void
  setBinauralEnabled: (enabled: boolean) => void
  setAmbientMuted: (muted: boolean) => void
  setAmbienceTrackVolume: (soundId: AmbienceSoundId, volume: number) => void
  toggleAmbienceTrack: (soundId: AmbienceSoundId) => void
  muteAllAmbienceTracks: () => void
  toggleAmbienceFavorite: (soundId: AmbienceSoundId) => void
  applyAmbienceMix: (mix: AmbienceMix) => void
  saveUserMix: (name: string, description?: string) => void
  deleteUserMix: (id: string) => void
  setAmbienceCategoryFilter: (category: AmbienceCategory | 'all' | 'favorites') => void
  setAmbienceSearchQuery: (query: string) => void
  setBreathRunning: (running: boolean) => void
  setBreathPattern: (patch: Partial<BreathPattern>) => void
  setBreathCues: (enabled: boolean) => void
  updateVisuals: (patch: Partial<VisualSettings>) => void
  updateRecording: (patch: Partial<RecordingSettings>) => void
  setSessions: (sessions: SavedSession[]) => void
  addSession: (session: SavedSession) => void
  updateSession: (id: string, patch: Partial<SavedSession>) => void
  deleteSession: (id: string) => void
  setSessionPlayback: (patch: Partial<SessionPlaybackState>) => void
  resetSessionPlayback: () => void
  setSleepTimer: (minutes: number) => void
  extendSleepTimer: (additionalMinutes: number) => void
  updateSleepTimer: (patch: Partial<SleepTimerState>) => void
  clearSleepTimer: () => void
  setFullscreenShortcut: (shortcut: FullscreenShortcut) => void
  resetPreferences: () => void
}

function systemReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const defaultAudio: AudioSettings = {
  carrier: 200,
  beat: 10,
  masterVolume: 0.66,
  binauralVolume: 0.38,
  binauralEnabled: false,
  modulation: false,
  ambientEnabled: true,
  ambientMuted: false,
  ambientMaster: 0.62,
  layers: {
    drone: 0.72,
    harmony: 0.56,
    wind: 0.44,
    resonance: 0.34,
  },
  reverbEnabled: true,
}

const defaultVisuals: VisualSettings = {
  quality: 'auto',
  particleDensity: 0.7,
  bloom: 0.68,
  contrast: 1.02,
  intensity: 0.82,
  reducedMotion: systemReducedMotion(),
}

const defaultRecording: RecordingSettings = {
  aspect: '16:9',
  resolution: 1080,
  fps: 30,
  quality: 'high',
  includeAudio: true,
  cleanCapture: true,
}

function getInitialSessions(): SavedSession[] {
  return [createStarterSession()]
}

export const useNocturneStore = create<NocturneState>()(
  persist(
    (set, get) => ({
      theme: 'dusk',
      ambientProfile: 'dusk',
      experienceStarted: false,
      mode: 'ambient',
      language: 'en',
      audioStatus: 'idle',
      micStatus: 'idle',
      micError: null,
      activePanel: null,
      isUiHidden: false,
      contextLost: false,
      toast: null,
      audio: { ...defaultAudio, layers: { ...defaultAudio.layers } },
      breathPattern: { ...DEFAULT_BREATH_PATTERN },
      breathRunning: false,
      breathCues: false,
      visuals: { ...defaultVisuals },
      recording: { ...defaultRecording },
      sessions: getInitialSessions(),
      sessionPlayback: idlePlayback(),
      sleepTimer: idleSleepTimer(),
      fullscreenShortcut: 'f',
      ambienceTrackVolumes: {},
      ambienceFavorites: ['rain', 'fireplace', 'brown_noise', 'spatial_drone'],
      userMixes: [],
      activeMixId: null,
      ambienceCategoryFilter: 'all',
      ambienceSearchQuery: '',

      setLanguage: (language) => set({ language }),

      setTheme: (theme) =>
        set({
          theme,
          ambientProfile: theme,
        }),

      setAmbientProfile: (ambientProfile) => set({ ambientProfile }),

      setMode: (mode) => {
        const current = get()
        if (mode === 'ambient') {
          set({
            mode,
            breathRunning: false,
            audio: { ...current.audio, binauralEnabled: false },
          })
          return
        }
        if (mode === 'binaural') {
          set({
            mode,
            breathRunning: false,
            audio: { ...current.audio, binauralEnabled: true },
          })
          return
        }
        set({
          mode,
          breathRunning: true,
        })
      },

      setExperienceStarted: (experienceStarted) => set({ experienceStarted }),
      setAudioStatus: (audioStatus) => set({ audioStatus }),
      setMicStatus: (micStatus, micError = null) => set({ micStatus, micError }),

      setPanel: (activePanel) => set({ activePanel, isUiHidden: false }),
      togglePanel: (panel) =>
        set((state) => ({
          activePanel: state.activePanel === panel ? null : panel,
          isUiHidden: false,
        })),
      setUiHidden: (isUiHidden) => set({ isUiHidden, activePanel: isUiHidden ? null : get().activePanel }),
      setContextLost: (contextLost) => set({ contextLost }),

      showToast: (message, tone = 'quiet') =>
        set({ toast: { id: Date.now() + Math.random(), message, tone } }),
      clearToast: () => set({ toast: null }),

      updateAudio: (patch) => set((state) => ({ audio: { ...state.audio, ...patch } })),
      updateAmbientLayers: (patch) =>
        set((state) => ({
          audio: {
            ...state.audio,
            layers: { ...state.audio.layers, ...patch },
          },
        })),
      setBinauralEnabled: (enabled) => {
        const state = get()
        const nextMode: ExperienceMode =
          state.mode === 'breath' ? 'breath' : enabled ? 'binaural' : 'ambient'
        set({
          mode: nextMode,
          audio: {
            ...state.audio,
            binauralEnabled: enabled,
            carrier: clampCarrier(state.audio.carrier),
            beat: clampBeat(state.audio.beat),
          },
        })
      },
      setAmbientMuted: (ambientMuted) => {
        const state = get()
        set({ audio: { ...state.audio, ambientMuted } })
      },

      setAmbienceTrackVolume: (soundId, volume) =>
        set((state) => {
          const clamped = Math.max(0, Math.min(1, volume))
          const next = { ...state.ambienceTrackVolumes }
          if (clamped <= 0.001) {
            delete next[soundId]
          } else {
            next[soundId] = clamped
          }
          return { ambienceTrackVolumes: next, activeMixId: null }
        }),

      toggleAmbienceTrack: (soundId) =>
        set((state) => {
          const current = state.ambienceTrackVolumes[soundId] ?? 0
          const next = { ...state.ambienceTrackVolumes }
          let nextProfile = state.ambientProfile
          if (current > 0.001) {
            delete next[soundId]
            if (nextProfile === soundId) {
              const remaining = Object.keys(next) as AmbienceSoundId[]
              nextProfile = remaining.length > 0 ? remaining[0] : state.theme
            }
          } else {
            const defVol = AMBIENCE_SOUNDS[soundId]?.defaultVolume ?? 0.65
            next[soundId] = defVol
            nextProfile = soundId
          }
          return {
            ambienceTrackVolumes: next,
            ambientProfile: nextProfile,
            activeMixId: null,
          }
        }),

      muteAllAmbienceTracks: () =>
        set((state) => ({
          ambienceTrackVolumes: {},
          ambientProfile: state.theme,
          activeMixId: null,
        })),

      toggleAmbienceFavorite: (soundId) =>
        set((state) => {
          const exists = state.ambienceFavorites.includes(soundId)
          const next = exists
            ? state.ambienceFavorites.filter((id) => id !== soundId)
            : [...state.ambienceFavorites, soundId]
          return { ambienceFavorites: next }
        }),

      applyAmbienceMix: (mix) =>
        set({
          ambienceTrackVolumes: { ...mix.tracks },
          activeMixId: mix.id,
        }),

      saveUserMix: (name, description = '') => {
        const language = get().language
        const fallbackName = translate(language, 'ambience.defaultMixName')
        set((state) => {
          const tracks = Object.fromEntries(
            Object.entries(state.ambienceTrackVolumes).filter(
              ([, volume]) => (volume ?? 0) > 0.001,
            ),
          ) as Partial<Record<AmbienceSoundId, number>>
          const count = Object.keys(tracks).length
          if (count === 0) return {}
          const newMix: AmbienceMix = {
            id: `user_mix_${Date.now()}`,
            name: name.trim() || fallbackName,
            description:
              description.trim() ||
              translate(language, 'ambience.defaultMixDescription', { count }),
            isPreset: false,
            tracks,
            createdAt: Date.now(),
          }
          return {
            userMixes: [newMix, ...state.userMixes],
            activeMixId: newMix.id,
            ambientProfile: newMix.id,
          }
        })
      },

      deleteUserMix: (id) =>
        set((state) => ({
          userMixes: state.userMixes.filter((m) => m.id !== id),
          activeMixId: state.activeMixId === id ? null : state.activeMixId,
        })),

      setAmbienceCategoryFilter: (ambienceCategoryFilter) =>
        set({ ambienceCategoryFilter }),

      setAmbienceSearchQuery: (ambienceSearchQuery) =>
        set({ ambienceSearchQuery }),
      setBreathRunning: (breathRunning) => set({ breathRunning }),
      setBreathPattern: (patch) =>
        set((state) => ({ breathPattern: { ...state.breathPattern, ...patch } })),
      setBreathCues: (breathCues) => set({ breathCues }),
      updateVisuals: (patch) => set((state) => ({ visuals: { ...state.visuals, ...patch } })),
      updateRecording: (patch) => set((state) => ({ recording: { ...state.recording, ...patch } })),

      setSessions: (sessions) => set({ sessions }),
      addSession: (session) => set((state) => ({ sessions: [session, ...state.sessions] })),
      updateSession: (id, patch) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id ? { ...session, ...patch, updatedAt: Date.now() } : session,
          ),
        })),
      deleteSession: (id) =>
        set((state) => ({ sessions: state.sessions.filter((session) => session.id !== id) })),
      setSessionPlayback: (patch) =>
        set((state) => ({ sessionPlayback: { ...state.sessionPlayback, ...patch } })),
      resetSessionPlayback: () => set({ sessionPlayback: idlePlayback() }),

      setSleepTimer: (minutes) => {
        const safeMinutes = Math.max(1, Math.round(minutes))
        const durationMs = safeMinutes * 60_000
        set({
          sleepTimer: {
            endsAt: Date.now() + durationMs,
            minutes: safeMinutes,
            remainingMs: durationMs,
          },
        })
      },
      extendSleepTimer: (additionalMinutes) =>
        set((state) => {
          if (!state.sleepTimer.endsAt) return {}
          const safeAdd = Math.max(1, Math.round(additionalMinutes))
          const addMs = safeAdd * 60_000
          const endsAt = state.sleepTimer.endsAt + addMs
          const remainingMs = Math.max(0, endsAt - Date.now())
          return {
            sleepTimer: {
              endsAt,
              minutes: Math.round(remainingMs / 60_000),
              remainingMs,
            },
          }
        }),
      updateSleepTimer: (patch) =>
        set((state) => ({ sleepTimer: { ...state.sleepTimer, ...patch } })),
      clearSleepTimer: () => set({ sleepTimer: idleSleepTimer() }),

      setFullscreenShortcut: (fullscreenShortcut) => set({ fullscreenShortcut }),

      resetPreferences: () =>
        set({
          theme: 'dusk',
          ambientProfile: 'dusk',
          audio: { ...defaultAudio, layers: { ...defaultAudio.layers } },
          breathPattern: { ...DEFAULT_BREATH_PATTERN },
          breathCues: false,
          visuals: {
            ...defaultVisuals,
            reducedMotion: systemReducedMotion(),
          },
          recording: { ...defaultRecording },
          sleepTimer: idleSleepTimer(),
          fullscreenShortcut: 'f',
          toast: {
            id: Date.now(),
            message: translate(get().language, 'settings.resetToast'),
            tone: 'quiet',
          },
        }),
    }),
    {
      name: 'nocturne-preferences-v1',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        language: state.language,
        theme: state.theme,
        ambientProfile: state.ambientProfile,
        audio: {
          ...state.audio,
          // Sound may never begin without an explicit gesture. These are
          // intentionally reset on every visit.
          binauralEnabled: false,
        },
        breathPattern: state.breathPattern,
        breathCues: state.breathCues,
        visuals: state.visuals,
        recording: state.recording,
        sessions: state.sessions,
        fullscreenShortcut: state.fullscreenShortcut,
        ambienceTrackVolumes: state.ambienceTrackVolumes,
        ambienceFavorites: state.ambienceFavorites,
        userMixes: state.userMixes,
        activeMixId: state.activeMixId,
      }),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current
        const saved = persisted as Partial<NocturneState>
        const theme = saved.theme && isThemeId(saved.theme) ? saved.theme : current.theme
        const language = isLanguageCode(saved.language) ? saved.language : current.language
        const visuals: VisualSettings = {
          ...current.visuals,
          ...(saved.visuals ?? {}),
        }
        const audio: AudioSettings = {
          ...current.audio,
          ...(saved.audio ?? {}),
          layers: {
            ...current.audio.layers,
            ...(saved.audio?.layers ?? {}),
          },
          binauralEnabled: false,
        }
        return {
          ...current,
          ...saved,
          language,
          theme,
          ambientProfile: saved.ambientProfile ? saved.ambientProfile : theme,
          audio: {
            ...audio,
            carrier: clampCarrier(audio.carrier),
            beat: clampBeat(audio.beat),
          },
          visuals,
          recording: { ...current.recording, ...(saved.recording ?? {}) },
          breathPattern: { ...current.breathPattern, ...(saved.breathPattern ?? {}) },
          sessions: Array.isArray(saved.sessions) ? saved.sessions : current.sessions,
          ambienceTrackVolumes: sanitizeTrackVolumes(saved.ambienceTrackVolumes),
          ambienceFavorites: Array.isArray(saved.ambienceFavorites)
            ? saved.ambienceFavorites
            : current.ambienceFavorites,
          userMixes: Array.isArray(saved.userMixes) ? saved.userMixes : current.userMixes,
          activeMixId:
            typeof saved.activeMixId === 'string' ? saved.activeMixId : current.activeMixId,
          experienceStarted: false,
          mode: 'ambient',
          audioStatus: 'idle',
          micStatus: 'idle',
          micError: null,
          activePanel: null,
          isUiHidden: false,
          contextLost: false,
          toast: null,
          sessionPlayback: idlePlayback(),
          sleepTimer: idleSleepTimer(),
          breathRunning: false,
        }
      },
    },
  ),
)

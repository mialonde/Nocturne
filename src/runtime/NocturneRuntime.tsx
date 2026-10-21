import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AudioEngine } from '../audio/AudioEngine'
import { computeBinauralPair } from '../config/audio'
import { THEMES } from '../config/themes'
import { clearMediaSession, createMediaTransport, updateMediaSession } from '../platform/mediaSession'
import { ScreenAwake } from '../platform/screenAwake'
import { AudioExporter } from '../recording/AudioExporter'
import { RecordingEngine } from '../recording/RecordingEngine'
import { SessionPlayer } from '../session/SessionPlayer'
import { useNocturneStore } from '../store/useNocturneStore'
import { Environment3D } from '../three/Environment3D'
import { readPersonalAudio } from '../storage/personalAudio'
import type {
  BreathState,
  SavedSession,
} from '../types'

export interface NocturneRuntime {
  audio: AudioEngine
  recording: RecordingEngine
  audioExporter: AudioExporter
  environment: Environment3D | null
  stageError: string | null
  isFullscreen: boolean
  beginExperience: () => Promise<void>
  togglePlayback: () => Promise<void>
  stopAll: () => void
  startSession: (session: SavedSession) => Promise<void>
  pauseSession: () => void
  resumeSession: () => Promise<void>
  stopSession: () => void
  enableMicrophone: () => Promise<void>
  disableMicrophone: () => void
  toggleFullscreen: () => Promise<void>
  startRecording: () => Promise<void>
  startAudioExport: () => Promise<void>
  stopAudioExport: () => Promise<void>
  discardAudioExport: () => void
  getBreathState: () => BreathState | null
}

const RuntimeContext = createContext<NocturneRuntime | null>(null)

function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export function NocturneRuntimeProvider({ children }: { children: ReactNode }) {
  const stageHostRef = useRef<HTMLDivElement | null>(null)
  const environmentRef = useRef<Environment3D | null>(null)
  const [environment, setEnvironment] = useState<Environment3D | null>(null)
  const [stageError, setStageError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false,
  )
  const [audio] = useState<AudioEngine>(() => {
    const state = useNocturneStore.getState()
    return new AudioEngine(state.audio, state.theme, state.ambientProfile)
  })
  const [sessionPlayer] = useState<SessionPlayer>(() => new SessionPlayer(audio))
  const [recording] = useState<RecordingEngine>(
    () => new RecordingEngine(audio, () => environmentRef.current),
  )
  const [audioExporter] = useState<AudioExporter>(() => new AudioExporter(audio))
  const [screenAwake] = useState<ScreenAwake>(() => new ScreenAwake())
  const beginPromiseRef = useRef<Promise<void> | null>(null)
  const captureErrorRef = useRef(0)

  const attachAnalysers = useCallback(() => {
    environmentRef.current?.setAnalyzers(audio.getAnalyser(), audio.getMicrophoneAnalyser())
  }, [audio])

  const beginExperience = useCallback(async (): Promise<void> => {
    if (beginPromiseRef.current) {
      await beginPromiseRef.current
      return
    }
    const action = async () => {
      const state = useNocturneStore.getState()
      if (!state.experienceStarted) {
        state.setExperienceStarted(true)
      }
      if (audio.isPlaying()) {
        if (useNocturneStore.getState().audioStatus !== 'playing') {
          useNocturneStore.getState().setAudioStatus('playing')
        }
        attachAnalysers()
        return
      }
      useNocturneStore.getState().setAudioStatus('starting')
      try {
        await audio.start(4.2)
        useNocturneStore.getState().setAudioStatus('playing')
        attachAnalysers()
      } catch (error) {
        useNocturneStore.getState().setAudioStatus('error')
        useNocturneStore
          .getState()
          .showToast(describeError(error, 'Sound could not begin in this browser.'), 'error')
      }
    }
    const promise = action().finally(() => {
      beginPromiseRef.current = null
    })
    beginPromiseRef.current = promise
    await promise
  }, [attachAnalysers, audio])

  const togglePlayback = useCallback(async (): Promise<void> => {
    if (sessionPlayer.isActive()) {
      if (sessionPlayer.isPaused()) {
        await sessionPlayer.resume()
      } else {
        sessionPlayer.pause()
      }
      return
    }
    const state = useNocturneStore.getState()
    if (audio.isPlaying()) {
      await audio.pause(0.65)
      state.setAudioStatus('paused')
      return
    }
    if (!state.experienceStarted) {
      await beginExperience()
      return
    }
    state.setAudioStatus('starting')
    try {
      await audio.start(1.35)
      state.setAudioStatus('playing')
      if (state.mode === 'breath') state.setBreathRunning(true)
      attachAnalysers()
    } catch (error) {
      state.setAudioStatus('error')
      state.showToast(describeError(error, 'Sound could not resume in this browser.'), 'error')
    }
  }, [attachAnalysers, audio, beginExperience, sessionPlayer])

  const stopAll = useCallback((): void => {
    if (sessionPlayer.isActive()) sessionPlayer.stop()
    void audio.stop(0.9)
    useNocturneStore.getState().clearSleepTimer()
    useNocturneStore.getState().setAudioStatus('paused')
    clearMediaSession()
    window.setTimeout(() => audio.resetSleepFade(0.5), 1100)
  }, [audio, sessionPlayer])

  const startSession = useCallback(
    async (session: SavedSession): Promise<void> => {
      if (!useNocturneStore.getState().experienceStarted) {
        useNocturneStore.getState().setExperienceStarted(true)
      }
      await sessionPlayer.start(session)
      const state = useNocturneStore.getState()
      if (state.sessionPlayback.status !== 'idle') {
        attachAnalysers()
      }
    },
    [attachAnalysers, sessionPlayer],
  )

  const pauseSession = useCallback((): void => {
    sessionPlayer.pause()
  }, [sessionPlayer])

  const resumeSession = useCallback(async (): Promise<void> => {
    await sessionPlayer.resume()
  }, [sessionPlayer])

  const stopSession = useCallback((): void => {
    sessionPlayer.stop()
  }, [sessionPlayer])

  const enableMicrophone = useCallback(async (): Promise<void> => {
    const state = useNocturneStore.getState()
    if (state.micStatus === 'requesting') return
    if (audio.isMicrophoneActive()) return
    state.setMicStatus('requesting')
    try {
      const analyser = await audio.startMicrophone()
      environmentRef.current?.setAnalyzers(audio.getAnalyser(), analyser)
      useNocturneStore.getState().setMicStatus('active')
      useNocturneStore
        .getState()
        .showToast('Microphone live. It moves the visuals only and is never recorded.', 'quiet')
    } catch (error) {
      const message = describeError(
        error,
        'Microphone access was not granted. Visuals will remain independent.',
      )
      useNocturneStore.getState().setMicStatus('error', message)
      useNocturneStore.getState().showToast(message, 'warning')
    }
  }, [audio])

  const disableMicrophone = useCallback((): void => {
    audio.stopMicrophone()
    environmentRef.current?.setAnalyzers(audio.getAnalyser(), null)
    useNocturneStore.getState().setMicStatus('idle')
    useNocturneStore.getState().showToast('Microphone released.', 'quiet')
  }, [audio])

  const toggleFullscreen = useCallback(async (): Promise<void> => {
    try {
      if (!document.fullscreenElement) {
        if (!document.fullscreenEnabled) {
          useNocturneStore
            .getState()
            .showToast('Fullscreen is not available in this browser or context.', 'warning')
          return
        }
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (error) {
      useNocturneStore
        .getState()
        .showToast(describeError(error, 'Fullscreen could not be entered.'), 'warning')
    }
  }, [])

  const startRecording = useCallback(async (): Promise<void> => {
    const state = useNocturneStore.getState()
    if (!state.experienceStarted) {
      await beginExperience()
    }
    if (!environmentRef.current) {
      state.showToast('The visual environment is not ready to record.', 'warning')
      return
    }
    if (sessionPlayer.isActive() && sessionPlayer.isPaused()) {
      await sessionPlayer.resume()
    } else if (!audio.isPlaying()) {
      const current = useNocturneStore.getState()
      current.setAudioStatus('starting')
      try {
        await audio.start(1.2)
        current.setAudioStatus('playing')
      } catch (error) {
        current.setAudioStatus('error')
        current.showToast(describeError(error, 'Audio could not start for the recording.'), 'error')
        return
      }
    }
    attachAnalysers()
    await recording.start(useNocturneStore.getState().recording)
  }, [attachAnalysers, audio, beginExperience, recording, sessionPlayer])

  const getBreathState = useCallback((): BreathState | null => {
    return environmentRef.current?.getBreathState() ?? null
  }, [])

  const startAudioExport = useCallback(async (): Promise<void> => {
    const state = useNocturneStore.getState()
    if (!state.experienceStarted) {
      await beginExperience()
    }
    if (!audio.isPlaying()) {
      try {
        await audio.start(1.2)
        useNocturneStore.getState().setAudioStatus('playing')
      } catch (error) {
        useNocturneStore.getState().showToast('The audio bus could not be opened.', 'error')
        return
      }
    }
    await audioExporter.start()
  }, [audio, audioExporter, beginExperience])

  const stopAudioExport = useCallback(async (): Promise<void> => {
    await audioExporter.stop()
  }, [audioExporter])

  const discardAudioExport = useCallback((): void => {
    audioExporter.discard()
  }, [audioExporter])

  // Create the visual stage once. Audio is deliberately silent until a gesture.
  useEffect(() => {
    const host = stageHostRef.current
    if (!host) return
    const state = useNocturneStore.getState()
    let stage: Environment3D | null = null
    try {
      stage = new Environment3D({
        container: host,
        initialTheme: state.theme,
        visuals: state.visuals,
        initialMode: state.mode,
        initialBreathRunning: state.breathRunning,
        initialBreathPattern: state.breathPattern,
        getCaptureTelemetry: () => {
          const current = useNocturneStore.getState()
          const pair = computeBinauralPair(current.audio.carrier, current.audio.beat)
          return {
            theme: THEMES[current.theme].name,
            mode:
              current.mode === 'breath'
                ? 'GUIDED BREATH'
                : current.mode === 'binaural'
                  ? 'BINAURAL FIELD'
                  : 'AMBIENT FIELD',
            leftHz: pair.left,
            rightHz: pair.right,
            beatHz: pair.beat,
          }
        },
        onContextLost: (lost) => {
          useNocturneStore.getState().setContextLost(lost)
          if (lost) {
            useNocturneStore
              .getState()
              .showToast('The graphics context was interrupted. Restoring the room…', 'warning')
          }
        },
        onCaptureError: (message) => {
          const now = performance.now()
          if (now - captureErrorRef.current < 10000) return
          captureErrorRef.current = now
          useNocturneStore.getState().showToast(message, 'error')
        },
        onBreathPhase: (phase) => {
          const current = useNocturneStore.getState()
          if (current.breathCues && current.audioStatus === 'playing') {
            audio.playBreathCue(phase)
          }
        },
      })
    } catch (error) {
      const message = describeError(
        error,
        'The 3D environment could not be created. WebGL may be unavailable.',
      )
      setStageError(message)
      useNocturneStore.getState().showToast(message, 'error')
    }
    if (!stage) return
    environmentRef.current = stage
    stage.setAnalyzers(audio.getAnalyser(), audio.getMicrophoneAnalyser())
    setEnvironment(stage)
    return () => {
      if (environmentRef.current === stage) environmentRef.current = null
      stage?.dispose()
    }
  }, [audio])

  // Push preferences into the audio and visual engines as they change. This is
  // intentionally a subscription rather than React state so high-frequency
  // session updates do not re-render the entire interface.
  useEffect(() => {
    const store = useNocturneStore
    const current = store.getState()
    audio.setAudioConfig(current.audio, 0.12)
    audio.configurePersonalAudio(current.features.personalEnabled, current.features.personalVolume, current.features.personalPan)
    audio.setTheme(current.theme, 0.2)
    audio.setAmbientProfile(current.ambientProfile, 0.2)
    audio.setAmbienceTrackVolumes(current.ambienceTrackVolumes, 0.12)
    environment?.setVisualSettings(current.visuals)
    environment?.setAudioOnly(current.features.audioOnly)
    environment?.setPracticeState(current.mode, current.breathRunning, current.breathPattern)
    environment?.setBinauralReadout(current.audio.carrier, current.audio.beat)

    let previous = current
    const unsubscribe = store.subscribe((state) => {
      const prior = previous
      previous = state
      if (state.features !== prior.features) {
        audio.configurePersonalAudio(state.features.personalEnabled, state.features.personalVolume, state.features.personalPan)
      }
      if (state.features.audioOnly !== prior.features.audioOnly) {
        environment?.setAudioOnly(state.features.audioOnly)
      }
      const inSession = state.sessionPlayback.status !== 'idle'
      const ramp = inSession
        ? Math.max(0.35, Math.min(30, state.sessionPlayback.transitionSec || 2))
        : 0.18
      if (state.audio !== prior.audio) {
        audio.setAudioConfig(state.audio, ramp)
        if (
          state.audio.carrier !== prior.audio.carrier ||
          state.audio.beat !== prior.audio.beat
        ) {
          environment?.setBinauralReadout(state.audio.carrier, state.audio.beat)
        }
      }
      if (state.ambienceTrackVolumes !== prior.ambienceTrackVolumes) {
        audio.setAmbienceTrackVolumes(state.ambienceTrackVolumes, ramp)
      }
      if (state.theme !== prior.theme) {
        audio.setTheme(state.theme, Math.min(6, ramp))
        environment?.setTheme(state.theme)
      }
      if (state.ambientProfile !== prior.ambientProfile) {
        audio.setAmbientProfile(state.ambientProfile, Math.min(6, ramp))
      }
      if (state.visuals !== prior.visuals) {
        environment?.setVisualSettings(state.visuals)
      }
      if (
        state.mode !== prior.mode ||
        state.breathRunning !== prior.breathRunning ||
        state.breathPattern !== prior.breathPattern
      ) {
        environment?.setPracticeState(state.mode, state.breathRunning, state.breathPattern)
      }
    })
    return unsubscribe
  }, [audio, environment])

  useEffect(() => {
    let active = true
    let loading = false
    const restoreAudio = () => {
      const state = useNocturneStore.getState()
      if (loading || audio.hasPersonalAudio() || state.audioStatus !== 'playing' || !state.features.personalEnabled) return
      loading = true
      void readPersonalAudio().then(async (file) => {
        if (active && file && !audio.hasPersonalAudio() && useNocturneStore.getState().features.personalEnabled) {
          await audio.loadPersonalAudio(file.blob)
        }
      }).catch((error) => {
        if (active) useNocturneStore.getState().showToast(describeError(error, 'Personal audio could not load.'), 'warning')
      }).finally(() => { loading = false })
    }
    const unsubscribe = useNocturneStore.subscribe((state, prior) => {
      if (state.audioStatus !== prior.audioStatus || state.features.personalEnabled !== prior.features.personalEnabled) restoreAudio()
    })
    restoreAudio()
    return () => { active = false; unsubscribe() }
  }, [audio])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Keep the display awake while the room plays, and publish the room to the
  // operating system media session so the lock screen can control it.
  useEffect(() => {
    const transport = createMediaTransport(
      () => sessionPlayer.isActive() ? !sessionPlayer.isPaused() : audio.isPlaying(),
      togglePlayback,
      stopAll,
      (error) => useNocturneStore.getState().showToast(
        describeError(error, 'Playback control failed.'), 'error',
      ),
    )

    const publish = () => {
      const state = useNocturneStore.getState()
      const playing = state.audioStatus === 'playing'
      void screenAwake.setEnabled(playing && state.features.keepAwake && !state.features.audioOnly)

      const playback = state.sessionPlayback
      if (playback.status !== 'idle') {
        updateMediaSession(
          {
            title: playback.sessionName || 'NOCTURNE',
            artist: 'NOCTURNE',
            album: playback.segmentLabel,
            playing,
            positionMs: playback.elapsedMs,
            durationMs: playback.totalMs,
            seekable: false,
          },
          transport,
        )
        return
      }

      if (playing || state.audioStatus === 'paused') {
        updateMediaSession(
          {
            title: 'NOCTURNE',
            artist: 'Ambient room',
            album: 'A room between states',
            playing,
            positionMs: 0,
            durationMs: 0,
            seekable: false,
          },
          transport,
        )
        return
      }

      clearMediaSession()
    }

    publish()
    const unsubscribe = useNocturneStore.subscribe((state, previous) => {
      if (
        state.audioStatus !== previous.audioStatus ||
        state.features !== previous.features ||
        state.sessionPlayback !== previous.sessionPlayback
      ) {
        publish()
      }
    })
    return () => {
      unsubscribe()
      void screenAwake.setEnabled(false)
      clearMediaSession()
    }
  }, [audio, screenAwake, sessionPlayer, stopAll, togglePlayback])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) return
      void screenAwake.refresh()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [screenAwake])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) return
      const state = useNocturneStore.getState()
      if (state.audioStatus === 'playing' && !sessionPlayer.isPaused()) {
        void audio.recoverIfSuspended().then((resumed) => {
          if (resumed) {
            useNocturneStore.getState().setAudioStatus('playing')
            attachAnalysers()
          }
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [attachAnalysers, audio, sessionPlayer])

  useEffect(() => {
    return () => {
      sessionPlayer.dispose()
      recording.dispose()
      audioExporter.dispose()
      audio.dispose()
    }
  }, [audio, audioExporter, recording, sessionPlayer])

  const value = useMemo<NocturneRuntime>(
    () => ({
      audio,
      recording,
      audioExporter,
      environment,
      stageError,
      isFullscreen,
      beginExperience,
      togglePlayback,
      stopAll,
      startSession,
      pauseSession,
      resumeSession,
      stopSession,
      enableMicrophone,
      disableMicrophone,
      toggleFullscreen,
      startRecording,
      startAudioExport,
      stopAudioExport,
      discardAudioExport,
      getBreathState,
    }),
    [
      audio,
      recording,
      audioExporter,
      environment,
      stageError,
      isFullscreen,
      beginExperience,
      togglePlayback,
      stopAll,
      startSession,
      pauseSession,
      resumeSession,
      stopSession,
      enableMicrophone,
      disableMicrophone,
      toggleFullscreen,
      startRecording,
      startAudioExport,
      stopAudioExport,
      discardAudioExport,
      getBreathState,
    ],
  )

  return (
    <RuntimeContext.Provider value={value}>
      <div className="app-shell">
        <div className="environment-stage" ref={stageHostRef} aria-hidden="true">
          {stageError ? (
            <div className="stage-fallback">
              <div className="stage-fallback__veil" />
              <p>The visual environment could not start.</p>
              <span>{stageError}</span>
            </div>
          ) : null}
        </div>
        {children}
      </div>
    </RuntimeContext.Provider>
  )
}

export function useNocturneRuntime(): NocturneRuntime {
  const runtime = useContext(RuntimeContext)
  if (!runtime) {
    throw new Error('useNocturneRuntime must be used inside NocturneRuntimeProvider.')
  }
  return runtime
}

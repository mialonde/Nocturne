import type { AudioEngine } from '../audio/AudioEngine'
import { clampBeat, clampCarrier } from '../config/audio'
import { findSegmentAtTime, normalizeSegments, totalSessionDuration } from '../config/sessions'
import { useNocturneStore } from '../store/useNocturneStore'
import type {
  AudioSettings,
  BreathPattern,
  ExperienceMode,
  SavedSession,
  SessionSegment,
  SoundscapeProfileId,
  ThemeId,
} from '../types'
import { segmentEnvelope } from './envelope'
import { automationFrame, type VisualAutomationFrame } from './automation'
import { AMBIENCE_SOUNDS, PRESET_MIXES, type AmbienceSoundId } from '../config/ambience'
import { isThemeId, THEMES } from '../config/themes'

interface SessionBaseline {
  theme: ThemeId
  ambientProfile: SoundscapeProfileId
  mode: ExperienceMode
  audio: AudioSettings
  breathPattern: BreathPattern
  breathRunning: boolean
  tracks: Partial<Record<AmbienceSoundId, number>>
}

function cloneSession(session: SavedSession): SavedSession {
  return {
    ...session,
    segments: normalizeSegments(session.segments).map((segment) => ({
      ...segment,
      breathPattern: { ...segment.breathPattern },
    })),
  }
}

function cloneAudio(audio: AudioSettings): AudioSettings {
  return {
    ...audio,
    layers: { ...audio.layers },
  }
}

export class SessionPlayer {
  private readonly audio: AudioEngine
  private session: SavedSession | null = null
  private baseline: SessionBaseline | null = null
  private timer: number | null = null
  private active = false
  private paused = false
  private accumulatedMs = 0
  private activeStartedAt = 0
  private totalMs = 0
  private segmentIndex = -1
  private lastUiUpdate = 0
  private disposed = false
  private automationStart: VisualAutomationFrame = { intensity: 0.82, bloom: 0.68, cameraMotion: 1 }
  private automationCurrent: VisualAutomationFrame | null = null
  private readonly onAutomation: (frame: VisualAutomationFrame | null) => void

  constructor(audio: AudioEngine, onAutomation: (frame: VisualAutomationFrame | null) => void = () => {}) {
    this.audio = audio
    this.onAutomation = onAutomation
  }

  isActive(): boolean {
    return this.active
  }

  isPaused(): boolean {
    return this.active && this.paused
  }

  async start(session: SavedSession): Promise<void> {
    if (this.disposed) return
    if (this.active) {
      this.stopSession(false)
    }
    const segments = normalizeSegments(session.segments)
    if (segments.length === 0) {
      useNocturneStore.getState().showToast('This session has no passages yet.', 'warning')
      return
    }
    const state = useNocturneStore.getState()
    this.baseline = {
      theme: state.theme,
      ambientProfile: state.ambientProfile,
      mode: state.mode,
      audio: cloneAudio(state.audio),
      breathPattern: { ...state.breathPattern },
      breathRunning: state.breathRunning,
      tracks: { ...state.ambienceTrackVolumes },
    }
    const copy = cloneSession({ ...session, segments })
    this.session = copy
    this.totalMs = totalSessionDuration(copy.segments)
    this.active = true
    this.paused = false
    this.accumulatedMs = 0
    this.activeStartedAt = performance.now()
    this.segmentIndex = -1
    this.lastUiUpdate = 0

    useNocturneStore.getState().setExperienceStarted(true)
    useNocturneStore.getState().setAudioStatus('starting')
    try {
      await this.audio.start(1.4)
    } catch (error) {
      this.active = false
      this.session = null
      this.baseline = null
      useNocturneStore.getState().setAudioStatus('error')
      useNocturneStore
        .getState()
        .showToast(error instanceof Error ? error.message : 'The session audio could not begin.', 'error')
      return
    }
    useNocturneStore.getState().setAudioStatus('playing')
    this.activeStartedAt = performance.now()
    this.accumulatedMs = 0
    this.applySegment(0)
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = window.setInterval(this.tick, 70)
    this.tick()
  }

  private elapsedMs(): number {
    if (!this.active) return this.accumulatedMs
    if (this.paused) return this.accumulatedMs
    return this.accumulatedMs + (performance.now() - this.activeStartedAt)
  }

  private tick = (): void => {
    if (!this.active || this.paused || !this.session || this.disposed) return
    const elapsed = this.elapsedMs()
    if (elapsed >= this.totalMs) {
      this.finish(true)
      return
    }
    const found = findSegmentAtTime(this.session.segments, elapsed)
    if (!found) {
      this.finish(true)
      return
    }
    if (found.index !== this.segmentIndex) {
      const previous = this.session.segments[this.segmentIndex]
      if (previous?.automation) this.applyAutomation(previous, 1)
      this.applySegment(found.index)
    }
    const segment = this.session.segments[found.index]
    if (!segment) return
    const localSeconds = found.segmentElapsedMs / 1000
    if (segment.automation) this.applyAutomation(segment, localSeconds / segment.durationSec)
    const gain = segmentEnvelope(localSeconds, segment)
    this.audio.setSessionFade(Math.max(0.0001, gain), 0.14)
    const now = performance.now()
    if (now - this.lastUiUpdate > 220 || found.index !== this.segmentIndex) {
      this.lastUiUpdate = now
      useNocturneStore.getState().setSessionPlayback({
        status: 'playing',
        elapsedMs: elapsed,
        segmentElapsedMs: found.segmentElapsedMs,
        segmentIndex: found.index,
        transitionSec: segment.transitionSec,
      })
    }
  }

  private applySegment(index: number): void {
    const session = this.session
    if (!session) return
    const segment = session.segments[index]
    if (!segment) return
    this.segmentIndex = index
    const transition = Math.max(0.35, Math.min(30, segment.transitionSec || 1.8))
    const nextMode: ExperienceMode = segment.breathing
      ? 'breath'
      : segment.binaural
        ? 'binaural'
        : 'ambient'
    const state = useNocturneStore.getState()
    this.automationStart = this.automationCurrent ?? { intensity: state.visuals.intensity, bloom: state.visuals.bloom, cameraMotion: 1 }
    if (!segment.automation) {
      this.automationCurrent = null
      this.onAutomation(null)
    }
    const mix = [...PRESET_MIXES, ...state.userMixes].find((item) => item.id === segment.ambientProfile)
    const tracks = mix?.tracks ?? (Object.hasOwn(AMBIENCE_SOUNDS, segment.ambientProfile)
      ? { [segment.ambientProfile]: AMBIENCE_SOUNDS[segment.ambientProfile as AmbienceSoundId].defaultVolume }
      : isThemeId(segment.ambientProfile) ? THEMES[segment.ambientProfile].soundscape.tracks
      : this.baseline?.tracks ?? state.ambienceTrackVolumes)
    useNocturneStore.setState({
      theme: segment.theme,
      ambientProfile: segment.ambientProfile,
      ambienceTrackVolumes: { ...tracks },
      mode: nextMode,
      breathRunning: segment.breathing,
      breathPattern: { ...segment.breathPattern },
      audio: {
        ...state.audio,
        carrier: clampCarrier(segment.carrier),
        beat: clampBeat(segment.beat),
        binauralEnabled: segment.binaural,
      },
      sessionPlayback: {
        status: 'playing',
        sessionId: session.id,
        sessionName: session.name,
        segmentIndex: index,
        segmentLabel: segment.label,
        elapsedMs: this.elapsedMs(),
        segmentElapsedMs: findSegmentAtTime(session.segments, this.elapsedMs())?.segmentElapsedMs ?? 0,
        totalMs: this.totalMs,
        transitionSec: transition,
      },
    })
    this.audio.setSessionAmbientMultiplier(segment.ambientIntensity, Math.max(0.6, transition))
    const localSegment = findSegmentAtTime(session.segments, this.elapsedMs())
    if (localSegment) {
      const segmentElapsedSeconds = localSegment.segmentElapsedMs / 1000
      this.audio.setSessionFade(
        Math.max(0.0001, segmentEnvelope(segmentElapsedSeconds, segment)),
        0.2,
      )
      this.applyLadder(segment, Math.max(0, segment.durationSec - segmentElapsedSeconds))
    }
  }

  private applyAutomation(segment: SessionSegment, progress: number): void {
    if (!segment.automation) return
    this.automationCurrent = automationFrame(this.automationStart, segment.automation, progress)
    this.onAutomation(this.automationCurrent)
    const t = Math.max(0, Math.min(1, progress))
    this.audio.setSessionAmbientMultiplier(segment.ambientIntensity + (segment.automation.ambientTo - segment.ambientIntensity) * t, 0.12)
  }

  /**
   * Slides the beat difference across the rest of the passage. The ramp is
   * scheduled in the audio thread, so it keeps its shape no matter what the
   * interface does.
   */
  private applyLadder(segment: SessionSegment, remainingSeconds: number): void {
    const ladder = segment.ladder
    if (!ladder || !segment.binaural) return
    if (Math.abs(ladder.to - segment.beat) < 0.05) return
    if (remainingSeconds <= 0.5) return

    this.audio.setBinauralLadder(
      { carrier: segment.carrier, beat: segment.beat },
      { carrier: ladder.carrierTo ?? segment.carrier, beat: ladder.to },
      remainingSeconds,
    )
  }

  async resume(): Promise<void> {
    if (!this.active || !this.paused || this.disposed) return
    this.paused = false
    this.activeStartedAt = performance.now()
    useNocturneStore.getState().setSessionPlayback({ status: 'playing' })
    useNocturneStore.getState().setAudioStatus('starting')
    try {
      await this.audio.start(1)
      useNocturneStore.getState().setAudioStatus('playing')
      if (this.timer !== null) window.clearInterval(this.timer)
      this.timer = window.setInterval(this.tick, 70)
      this.tick()
    } catch (error) {
      this.paused = true
      useNocturneStore.getState().setAudioStatus('paused')
      useNocturneStore
        .getState()
        .showToast(error instanceof Error ? error.message : 'Audio could not resume.', 'error')
    }
  }

  pause(): void {
    if (!this.active || this.paused || this.disposed) return
    this.accumulatedMs = this.elapsedMs()
    this.paused = true
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    void this.audio.pause(0.55)
    const state = useNocturneStore.getState()
    state.setAudioStatus('paused')
    state.setSessionPlayback({ status: 'paused', elapsedMs: this.accumulatedMs })
  }

  stop(): void {
    this.stopSession(true)
  }

  private stopSession(restoreAudio: boolean): void {
    if (!this.active && !this.session) return
    this.automationCurrent = null
    this.onAutomation(null)
    this.active = false
    this.paused = false
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    this.audio.setSessionFade(1, 0.5)
    this.audio.setSessionAmbientMultiplier(1, 0.6)
    const state = useNocturneStore.getState()
    if (this.baseline) {
      state.setSessionPlayback({
        status: 'idle',
        sessionId: null,
        sessionName: '',
        segmentIndex: 0,
        segmentLabel: '',
        elapsedMs: 0,
        segmentElapsedMs: 0,
        totalMs: 0,
        transitionSec: 0,
      })
      useNocturneStore.setState({
        theme: this.baseline.theme,
        ambientProfile: this.baseline.ambientProfile,
        ambienceTrackVolumes: { ...this.baseline.tracks },
        mode: this.baseline.mode,
        audio: cloneAudio(this.baseline.audio),
        breathPattern: { ...this.baseline.breathPattern },
        breathRunning: this.baseline.breathRunning,
      })
      if (restoreAudio && !this.audio.isPlaying()) {
        state.setAudioStatus('paused')
      }
    }
    this.baseline = null
    this.session = null
    this.segmentIndex = -1
    this.accumulatedMs = 0
  }

  private finish(natural: boolean): void {
    if (!this.active && !this.session) return
    this.automationCurrent = null
    this.onAutomation(null)
    this.active = false
    this.paused = false
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    const state = useNocturneStore.getState()
    const lastTheme = state.theme
    const lastProfile = state.ambientProfile
    this.audio.setSessionFade(1, 0.4)
    this.audio.setSessionAmbientMultiplier(1, 0.5)
    if (this.baseline) {
      const finalMode: ExperienceMode = natural
        ? this.baseline.mode === 'breath'
          ? this.baseline.audio.binauralEnabled
            ? 'binaural'
            : 'ambient'
          : this.baseline.mode
        : this.baseline.mode
      useNocturneStore.setState({
        theme: natural ? lastTheme : this.baseline.theme,
        ambientProfile: natural ? lastProfile : this.baseline.ambientProfile,
        ambienceTrackVolumes: { ...(natural ? state.ambienceTrackVolumes : this.baseline.tracks) },
        mode: finalMode,
        audio: cloneAudio(this.baseline.audio),
        breathPattern: { ...this.baseline.breathPattern },
        breathRunning: natural ? false : this.baseline.breathRunning,
        sessionPlayback: {
          status: 'idle',
          sessionId: null,
          sessionName: '',
          segmentIndex: 0,
          segmentLabel: '',
          elapsedMs: 0,
          segmentElapsedMs: 0,
          totalMs: 0,
          transitionSec: 0,
        },
      })
    }
    if (natural) {
      void this.audio.pause(2.6)
      state.setAudioStatus('paused')
      state.showToast('The session has completed. The room remains.', 'quiet')
    } else {
      state.showToast('Session ended. Your own settings are restored.', 'quiet')
    }
    this.baseline = null
    this.session = null
    this.segmentIndex = -1
    this.accumulatedMs = 0
  }

  dispose(): void {
    this.onAutomation(null)
    this.disposed = true
    this.active = false
    this.paused = false
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    this.session = null
    this.baseline = null
  }
}

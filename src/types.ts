export type ThemeId = 'dusk' | 'void' | 'abyss' | 'ether' | 'cosmos'
export type ExperienceMode = 'ambient' | 'binaural' | 'breath'
export type PanelId = 'sound' | 'breath' | 'session' | 'studio' | 'settings'
export type {
  AmbienceCategory,
  AmbienceSoundId,
  AmbienceSoundDefinition,
  AmbienceMix,
} from './config/ambience'
import type { AmbienceSoundId } from './config/ambience'
export type SoundscapeProfileId = ThemeId | AmbienceSoundId | string
export type AudioStatus = 'idle' | 'starting' | 'playing' | 'paused' | 'error'
export type MicStatus = 'idle' | 'requesting' | 'active' | 'error'
export type QualitySetting = 'auto' | 'high' | 'balanced' | 'low'
export type RecordingAspect = '16:9' | '9:16' | '1:1'
export type RecordingQuality = 'high' | 'balanced' | 'compact'
export type FullscreenShortcut = 'f' | 'shift+f' | 'ctrl+shift+f' | 'alt+f'
export type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'rest'

export interface BreathPattern {
  inhale: number
  hold: number
  exhale: number
  rest: number
}

export interface AudioSettings {
  carrier: number
  beat: number
  masterVolume: number
  binauralVolume: number
  binauralEnabled: boolean
  modulation: boolean
  ambientEnabled: boolean
  ambientMuted: boolean
  ambientMaster: number
  layers: {
    drone: number
    harmony: number
    wind: number
    resonance: number
  }
  reverbEnabled: boolean
}

export interface VisualSettings {
  quality: QualitySetting
  particleDensity: number
  bloom: number
  contrast: number
  intensity: number
  reducedMotion: boolean
}

export interface RecordingSettings {
  aspect: RecordingAspect
  resolution: 720 | 1080 | 1440
  fps: 30 | 60
  quality: RecordingQuality
  includeAudio: boolean
  cleanCapture: boolean
}

export interface BeatLadder {
  /**
   * Beat difference in Hz at the end of the passage. The passage always
   * starts at its own beat value, so a ladder is a slide from there.
   */
  to: number
  /** Optional carrier drift in Hz over the passage. */
  carrierTo?: number
}

export interface SessionSegment {
  id: string
  label: string
  durationSec: number
  carrier: number
  beat: number
  theme: ThemeId
  ambientProfile: string
  ambientIntensity: number
  binaural: boolean
  breathing: boolean
  breathPattern: BreathPattern
  fadeInSec: number
  fadeOutSec: number
  transitionSec: number
  /** Slides the beat difference across the passage. */
  ladder?: BeatLadder | null
}

export interface SavedSession {
  id: string
  name: string
  note: string
  createdAt: number
  updatedAt: number
  segments: SessionSegment[]
}

export interface SessionPlaybackState {
  status: 'idle' | 'playing' | 'paused'
  sessionId: string | null
  sessionName: string
  segmentIndex: number
  segmentLabel: string
  elapsedMs: number
  segmentElapsedMs: number
  totalMs: number
  transitionSec: number
}

export interface ToastMessage {
  id: number
  message: string
  tone: 'quiet' | 'warning' | 'error'
}

export interface SleepTimerState {
  endsAt: number | null
  minutes: number | null
  remainingMs: number
}

export interface AudioAnalysis {
  level: number
  bass: number
}

export interface BreathState {
  enabled: boolean
  running: boolean
  phase: BreathPhase
  phaseProgress: number
  cycleProgress: number
  phaseRemainingMs: number
  cycleCount: number
}

export interface ThemeDefinition {
  id: ThemeId
  name: string
  subtitle: string
  description: string
  swatch: string
}

export interface CaptureConfig {
  aspect: RecordingAspect
  resolution: 720 | 1080 | 1440
  fps: 30 | 60
  includeOverlay: boolean
}

export interface CaptureHandle {
  canvas: HTMLCanvasElement
  stream: MediaStream
  dimensions: { width: number; height: number }
}

export interface RecordingSupport {
  supported: boolean
  captureSupported: boolean
  audioContextSupported: boolean
  mediaRecorderSupported: boolean
  mimeType: string | null
  label: string
  reason: string | null
}

export interface RecordingResult {
  url: string
  blob: Blob
  mimeType: string
  extension: string
  fileName: string
  durationMs: number
  width: number
  height: number
  hasAudio: boolean
  bytes: number
}

export interface MicrophoneState {
  status: MicStatus
  error: string | null
}

export interface FrequencyPair {
  left: number
  right: number
  beat: number
}

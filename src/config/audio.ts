import type { BreathPattern, ThemeId } from '../types'

export const CARRIER_MIN = 100
export const CARRIER_MAX = 500
export const BEAT_MIN = 0.5
export const BEAT_MAX = 40
export const TONE_CEILING = 0.42
export const MIN_SAFE_CONTEXT_GAIN = 0.0001

export interface FrequencyPreset {
  id: string
  name: string
  min: number
  max: number
  suggested: number
  description: string
}

export const FREQUENCY_PRESETS: FrequencyPreset[] = [
  {
    id: 'delta',
    name: 'DELTA',
    min: 0.5,
    max: 4,
    suggested: 2,
    description: '0.5–4 Hz · conventionally associated with deep sleep',
  },
  {
    id: 'theta',
    name: 'THETA',
    min: 4,
    max: 8,
    suggested: 6,
    description: '4–8 Hz · conventionally associated with light sleep and reverie',
  },
  {
    id: 'alpha',
    name: 'ALPHA',
    min: 8,
    max: 13,
    suggested: 10,
    description: '8–13 Hz · conventionally associated with relaxed wakefulness',
  },
  {
    id: 'beta',
    name: 'BETA',
    min: 13,
    max: 30,
    suggested: 20,
    description: '13–30 Hz · conventionally associated with active thinking',
  },
  {
    id: 'gamma',
    name: 'GAMMA',
    min: 30,
    max: 40,
    suggested: 35,
    description: '30–40 Hz · conventionally associated with high-frequency activity',
  },
]

export const DEFAULT_BREATH_PATTERN: BreathPattern = {
  inhale: 4,
  hold: 2,
  exhale: 6,
  rest: 2,
}

export const BREATH_PHASE_LABEL: Record<keyof BreathPattern, string> = {
  inhale: 'Inhale',
  hold: 'Hold',
  exhale: 'Exhale',
  rest: 'Rest',
}

export const AMBIENT_PROFILE_NAMES: Record<ThemeId, string> = {
  dusk: 'Dusk veil',
  void: 'Void expanse',
  abyss: 'Abyssal drone',
  ether: 'Ether harmonics',
  cosmos: 'Dimensional drift',
}

export interface AmbientProfileWeights {
  drone: number
  harmony: number
  wind: number
  resonance: number
  reverb: number
}

export const AMBIENT_WEIGHTS: Record<ThemeId, AmbientProfileWeights> = {
  dusk: { drone: 0.74, harmony: 0.52, wind: 0.46, resonance: 0.28, reverb: 0.68 },
  void: { drone: 0.48, harmony: 0.2, wind: 0.34, resonance: 0.1, reverb: 0.34 },
  abyss: { drone: 0.92, harmony: 0.4, wind: 0.72, resonance: 0.32, reverb: 0.76 },
  ether: { drone: 0.52, harmony: 0.95, wind: 0.28, resonance: 0.68, reverb: 0.9 },
  cosmos: { drone: 0.65, harmony: 0.58, wind: 0.22, resonance: 0.88, reverb: 0.96 },
}

export function clampCarrier(value: number): number {
  return Math.min(CARRIER_MAX, Math.max(CARRIER_MIN, value))
}

export function clampBeat(value: number): number {
  return Math.min(BEAT_MAX, Math.max(BEAT_MIN, value))
}

export function computeBinauralPair(carrier: number, beat: number): { left: number; right: number; beat: number } {
  const safeCarrier = clampCarrier(carrier)
  const safeBeat = clampBeat(beat)
  // The right oscillator is the lower tone, so the perceived beat is the
  // absolute difference between the ears. Left remains exactly the carrier.
  return {
    left: roundFrequency(safeCarrier),
    right: roundFrequency(safeCarrier - safeBeat),
    beat: roundFrequency(safeBeat),
  }
}

export function roundFrequency(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatHz(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)} Hz`
}

export function presetForBeat(beat: number): FrequencyPreset | null {
  return (
    FREQUENCY_PRESETS.find((preset) => {
      if (preset.id === 'gamma') return beat >= preset.min
      return beat >= preset.min && beat < preset.max
    }) ?? null
  )
}

export function getBreathCycleDuration(pattern: BreathPattern): number {
  return Math.max(0.1, pattern.inhale + pattern.hold + pattern.exhale + pattern.rest)
}

export interface LadderPreset {
  id: string
  name: string
  nameEn: string
  /** Beat difference at the end of the passage. */
  to: number
  description: string
  descriptionEn: string
}

/**
 * Ready-made slides across the beat difference. The passage always starts at
 * its own beat value and slides towards the target of the preset.
 */
export const LADDER_PRESETS: LadderPreset[] = [
  {
    id: 'alpha_theta',
    name: 'Alfa → Teta',
    nameEn: 'Alpha → Theta',
    to: 6,
    description: 'Sakin uyanıklıktan düşüncelere geçiş',
    descriptionEn: 'From relaxed wakefulness into reverie',
  },
  {
    id: 'alpha_delta',
    name: 'Alfa → Delta',
    nameEn: 'Alpha → Delta',
    to: 3,
    description: 'Yavaşlayan, derinleşen bir iniş',
    descriptionEn: 'A slow, deepening descent',
  },
  {
    id: 'theta_delta',
    name: 'Teta → Delta',
    nameEn: 'Theta → Delta',
    to: 2,
    description: 'Uykuya geçiş için alçalan fark',
    descriptionEn: 'A falling difference for the edge of sleep',
  },
  {
    id: 'beta_alpha',
    name: 'Beta → Alfa',
    nameEn: 'Beta → Alpha',
    to: 10,
    description: 'Dağınık zihinden sakin uyanıklığa',
    descriptionEn: 'From a scattered mind to calm wakefulness',
  },
]

export function findLadderPreset(to: number): LadderPreset | null {
  return LADDER_PRESETS.find((preset) => Math.abs(preset.to - to) < 0.05) ?? null
}

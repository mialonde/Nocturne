import type { AmbienceSoundId } from './ambience'
import type { ThemeDefinition, ThemeId } from '../types'

export interface ThemePalette {
  backgroundTop: string
  backgroundBottom: string
  backgroundAccent: string
  fog: string
  orbInner: string
  orbMid: string
  orbEdge: string
  particle: string
  ring: string
  halo: string
  shard: string
  keyLight: string
  fillLight: string
  particleFactor: number
  ringOpacity: number
  haloStrength: number
  distortion: number
  bloom: number
  veil: number
}

export interface AtmosphereTuning {
  droneRoot: number
  droneFilter: number
  harmonicRoot: number
  windCutoff: number
  reverbWet: number
  delayMix: number
  detuneCents: number
}

export interface ThemeConfig extends ThemeDefinition {
  palette: ThemePalette
  atmosphere: AtmosphereTuning
  soundscape: ThemeSoundscape
}

/**
 * The ambience that belongs to an atmosphere. Choosing an atmosphere can
 * carry this mix with it, so the room keeps its sound and its light in step.
 */
export interface ThemeSoundscape {
  tracks: Partial<Record<AmbienceSoundId, number>>
  note: string
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  dusk: {
    id: 'dusk',
    name: 'DUSK',
    subtitle: 'Void / Abyss',
    description: 'Near-black depth warmed by a slow blue breath. The quiet intersection of void and abyss.',
    swatch: '#101b2d',
    palette: {
      backgroundTop: '#05090f',
      backgroundBottom: '#010205',
      backgroundAccent: '#1b3047',
      fog: '#040810',
      orbInner: '#06111b',
      orbMid: '#23364a',
      orbEdge: '#a7c4d4',
      particle: '#a4bfd0',
      ring: '#7897a9',
      halo: '#27465d',
      shard: '#8aa6b7',
      keyLight: '#8ab8cd',
      fillLight: '#504c78',
      particleFactor: 0.78,
      ringOpacity: 0.19,
      haloStrength: 0.72,
      distortion: 0.105,
      bloom: 0.44,
      veil: 0.44,
    },
    atmosphere: {
      droneRoot: 51.91,
      droneFilter: 210,
      harmonicRoot: 103.83,
      windCutoff: 740,
      reverbWet: 0.52,
      delayMix: 0.22,
      detuneCents: 4,
    },
    soundscape: {
      tracks: { rain: 0.5, wind: 0.28, night_crickets: 0.18 },
      note: 'Rain on a window, a low wind and the occasional cricket.',
    },
  },
  void: {
    id: 'void',
    name: 'VOID',
    subtitle: 'Stillness',
    description: 'An almost-black room. Sparse dust, a low distant tone, and very little else.',
    swatch: '#070a10',
    palette: {
      backgroundTop: '#030509',
      backgroundBottom: '#000102',
      backgroundAccent: '#0d1722',
      fog: '#020409',
      orbInner: '#03080d',
      orbMid: '#121d2b',
      orbEdge: '#7f9aaa',
      particle: '#7f95a2',
      ring: '#526b7b',
      halo: '#132733',
      shard: '#6d8795',
      keyLight: '#628796',
      fillLight: '#31334d',
      particleFactor: 0.34,
      ringOpacity: 0.1,
      haloStrength: 0.48,
      distortion: 0.085,
      bloom: 0.3,
      veil: 0.24,
    },
    atmosphere: {
      droneRoot: 43.65,
      droneFilter: 160,
      harmonicRoot: 87.31,
      windCutoff: 480,
      reverbWet: 0.38,
      delayMix: 0.1,
      detuneCents: 2.2,
    },
    soundscape: {
      tracks: { brown_noise: 0.34, ventilation: 0.26, low_intensity_tones: 0.3 },
      note: 'Brown noise, distant ventilation and a floor tone.',
    },
  },
  abyss: {
    id: 'abyss',
    name: 'ABYSS',
    subtitle: 'Deep water',
    description: 'Layered blue pressure, drifting particulates and slow, tidal surface distortions.',
    swatch: '#0a2033',
    palette: {
      backgroundTop: '#04111d',
      backgroundBottom: '#01040a',
      backgroundAccent: '#123a52',
      fog: '#020b14',
      orbInner: '#03121d',
      orbMid: '#123c56',
      orbEdge: '#93c7dd',
      particle: '#9fc9db',
      ring: '#6899ad',
      halo: '#164760',
      shard: '#8bb8c8',
      keyLight: '#6eb7d2',
      fillLight: '#34547c',
      particleFactor: 1,
      ringOpacity: 0.2,
      haloStrength: 0.82,
      distortion: 0.125,
      bloom: 0.5,
      veil: 0.58,
    },
    atmosphere: {
      droneRoot: 41.2,
      droneFilter: 185,
      harmonicRoot: 82.41,
      windCutoff: 610,
      reverbWet: 0.66,
      delayMix: 0.3,
      detuneCents: 5.5,
    },
    soundscape: {
      tracks: { ocean: 0.58, wind: 0.3, deep_resonance: 0.22 },
      note: 'Slow shore break under a deep resonance.',
    },
  },
  ether: {
    id: 'ether',
    name: 'ETHER',
    subtitle: 'Silver air',
    description: 'Translucent violet geometry, fine concentric rings and slowly opening harmonics.',
    swatch: '#24203b',
    palette: {
      backgroundTop: '#090814',
      backgroundBottom: '#020207',
      backgroundAccent: '#261f42',
      fog: '#06050d',
      orbInner: '#0a0816',
      orbMid: '#332e50',
      orbEdge: '#d6cce6',
      particle: '#c8bddb',
      ring: '#a49bc2',
      halo: '#38305f',
      shard: '#c0b5d6',
      keyLight: '#b9a9dc',
      fillLight: '#65749c',
      particleFactor: 0.72,
      ringOpacity: 0.27,
      haloStrength: 0.76,
      distortion: 0.095,
      bloom: 0.42,
      veil: 0.5,
    },
    atmosphere: {
      droneRoot: 58.27,
      droneFilter: 260,
      harmonicRoot: 116.54,
      windCutoff: 980,
      reverbWet: 0.7,
      delayMix: 0.26,
      detuneCents: 3.4,
    },
    soundscape: {
      tracks: { forest: 0.42, spatial_drone: 0.3, minimal_ambient: 0.32 },
      note: 'Birdsong, an open drone and sparse minimal tones.',
    },
  },
  cosmos: {
    id: 'cosmos',
    name: 'COSMOS',
    subtitle: '6D Consciousness',
    description: 'Translucent layers of space and time. Geometry that drifts between states without resolution.',
    swatch: '#0d0a1f',
    palette: {
      backgroundTop: '#050410',
      backgroundBottom: '#020108',
      backgroundAccent: '#1a1340',
      fog: '#030210',
      orbInner: '#080615',
      orbMid: '#1e1640',
      orbEdge: '#c8bfe8',
      particle: '#a8a0cc',
      ring: '#6b5f9e',
      halo: '#2a1f52',
      shard: '#b8aedd',
      keyLight: '#c4b8e8',
      fillLight: '#4a3d7a',
      particleFactor: 0.62,
      ringOpacity: 0.22,
      haloStrength: 0.85,
      distortion: 0.08,
      bloom: 0.55,
      veil: 0.62,
    },
    atmosphere: {
      droneRoot: 46.25,
      droneFilter: 190,
      harmonicRoot: 92.5,
      windCutoff: 560,
      reverbWet: 0.78,
      delayMix: 0.32,
      detuneCents: 6,
    },
    soundscape: {
      tracks: { deep_resonance: 0.38, spatial_drone: 0.42, synthetic_atmosphere: 0.32 },
      note: 'Resonance, a wide drone and a synthetic shimmer.',
    },
  },
}

export const THEME_LIST: ThemeConfig[] = [
  THEMES.dusk,
  THEMES.void,
  THEMES.abyss,
  THEMES.ether,
  THEMES.cosmos,
]

export function isThemeId(value: unknown): value is ThemeId {
  return value === 'dusk' || value === 'void' || value === 'abyss' || value === 'ether' || value === 'cosmos'
}

import { describe, expect, it } from 'vitest'
import {
  AMBIENCE_CATEGORIES,
  AMBIENCE_SOUND_LIST,
  AMBIENCE_SOUNDS,
  CLASSIC_THEME_PROFILES,
  PRESET_MIXES,
  getSoundscapeProfileLabel,
  getSoundsByCategory,
} from './ambience'

describe('Ambience Library configuration', () => {
  it('defines all required categories matching the specification', () => {
    const categoryIds = AMBIENCE_CATEGORIES.map((c) => c.id)
    expect(categoryIds).toEqual(['nature', 'noise', 'sleep', 'cosmic', 'tonal', 'my_mixes'])
  })

  it('contains the 5 Nature sounds', () => {
    const nature = getSoundsByCategory('nature').map((s) => s.id)
    expect(nature).toEqual(['rain', 'storm', 'forest', 'wind', 'ocean'])
  })

  it('contains the 5 Noise sounds', () => {
    const noise = getSoundsByCategory('noise').map((s) => s.id)
    expect(noise).toEqual(['white_noise', 'pink_noise', 'brown_noise', 'fan', 'ventilation'])
  })

  it('contains the 3 Sleep sounds', () => {
    const sleep = getSoundsByCategory('sleep').map((s) => s.id)
    expect(sleep).toEqual(['night_crickets', 'fireplace', 'distant_thunder'])
  })

  it('contains the 3 Cosmic sounds', () => {
    const cosmic = getSoundsByCategory('cosmic').map((s) => s.id)
    expect(cosmic).toEqual(['spatial_drone', 'deep_resonance', 'synthetic_atmosphere'])
  })

  it('contains the 3 Tonal sounds', () => {
    const tonal = getSoundsByCategory('tonal').map((s) => s.id)
    expect(tonal).toEqual(['minimal_ambient', 'long_pads', 'low_intensity_tones'])
  })

  it('has exactly 19 distinct sound definitions', () => {
    expect(AMBIENCE_SOUND_LIST.length).toBe(19)
    expect(Object.keys(AMBIENCE_SOUNDS).length).toBe(19)
  })

  it('contains curated preset mixes in My Mixes', () => {
    expect(PRESET_MIXES.length).toBeGreaterThanOrEqual(8)
    const titles = PRESET_MIXES.map((p) => p.name)
    expect(titles).toContain('Gece Yağmuru & Şömine')
    expect(titles).toContain('Fırtına Sığınağı')
    expect(titles).toContain('Derin Uyku Kozası')
    expect(titles).toContain('Orman Şafağı')
  })

  it('resolves labels correctly for sounds, presets, and classic themes', () => {
    const rainLabel = getSoundscapeProfileLabel('rain')
    expect(rainLabel.name).toBe('Yağmur')
    expect(rainLabel.category).toBe('NATURE')

    const mixLabel = getSoundscapeProfileLabel(PRESET_MIXES[0].id)
    expect(mixLabel.name).toBe(PRESET_MIXES[0].name)
    expect(mixLabel.category).toBe('MY MIXES')

    const duskLabel = getSoundscapeProfileLabel('dusk')
    expect(duskLabel.name).toBe('Dusk veil')
    expect(duskLabel.category).toBe('THEME')
  })

  it('preserves classic theme profiles for backwards compatibility', () => {
    expect(CLASSIC_THEME_PROFILES.map((p) => p.id)).toEqual([
      'dusk',
      'void',
      'abyss',
      'ether',
      'cosmos',
    ])
  })
})

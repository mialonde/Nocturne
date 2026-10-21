import { describe, expect, it } from 'vitest'
import { LOCALES, translate } from './index'
import { en } from './en'

describe('language catalogue', () => {
  it('has an English catalogue', () => {
    expect(LOCALES.en).toBe(en)
    expect(translate('en', 'sleep.title')).toBe('Sleep timer')
  })

  it('interpolates runtime values', () => {
    expect(translate('en', 'sleep.option', { minutes: 20 })).toBe('20 min')
    expect(translate('en', 'ambience.activeLayers', { count: 3 })).toBe('3 layers')
  })

  it('leaves unknown placeholders visible for debugging', () => {
    expect(translate('en', 'sleep.option', {})).toBe('{minutes} min')
  })
})

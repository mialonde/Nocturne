import { describe, expect, it } from 'vitest'
import { LOCALES, translate } from './index'
import { en } from './en'

describe('language catalogue', () => {
  it('has an English catalogue', () => {
    expect(LOCALES.en).toBe(en)
    expect(translate('en', 'sleep.title')).toBe('Sleep timer')
  })

  it('translates across all supported languages (tr, ru, ar, ja, zh)', () => {
    expect(translate('tr', 'sleep.title')).toBe('Uyku zamanlayıcısı')
    expect(translate('ru', 'sleep.title')).toBe('Таймер сна')
    expect(translate('ar', 'sleep.title')).toBe('مؤقت النوم')
    expect(translate('ja', 'sleep.title')).toBe('おやすみタイマー')
    expect(translate('zh', 'sleep.title')).toBe('睡眠定时器')
  })

  it('interpolates runtime values in translated languages', () => {
    expect(translate('tr', 'sleep.option', { minutes: 15 })).toBe('15 dk')
    expect(translate('ru', 'sleep.option', { minutes: 15 })).toBe('15 мин')
    expect(translate('ja', 'sleep.option', { minutes: 15 })).toBe('15分')
    expect(translate('zh', 'sleep.option', { minutes: 15 })).toBe('15 分钟')
  })
})

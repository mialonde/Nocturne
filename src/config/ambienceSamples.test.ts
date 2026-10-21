import { describe, expect, it } from 'vitest'
import { AMBIENCE_SOUNDS } from './ambience'
import {
  AMBIENCE_SAMPLE_CREDITS,
  AMBIENCE_SAMPLES,
  getAmbienceSampleCreditRows,
  hasAmbienceSample,
} from './ambienceSamples'

/** Only licences that allow the recording to be redistributed in the app. */
const REDISTRIBUTABLE_LICENCE = /cc0|cc-zero|public ?domain|publicdomain|no restrictions/i

describe('Ambience sample manifest', () => {
  it('ships the recorded ambience tracks', () => {
    const ids = Object.keys(AMBIENCE_SAMPLES)
    expect(ids).toContain('rain')
    expect(ids).toContain('wind')
    expect(ids).toContain('ocean')
    expect(ids).toContain('forest')
    expect(ids).toContain('distant_thunder')
    expect(ids).toContain('fireplace')
    expect(AMBIENCE_SAMPLE_CREDITS.length).toBe(ids.length)
  })

  it('only references sounds that exist in the ambience library', () => {
    for (const id of Object.keys(AMBIENCE_SAMPLES)) {
      expect(id in AMBIENCE_SOUNDS).toBe(true)
    }
  })

  it('uses a redistribution-safe licence for every recording', () => {
    for (const credit of AMBIENCE_SAMPLE_CREDITS) {
      expect(credit.license).toMatch(REDISTRIBUTABLE_LICENCE)
    }
  })

  it('records the author, the licence text and the source of every recording', () => {
    for (const credit of AMBIENCE_SAMPLE_CREDITS) {
      expect(credit.title.length).toBeGreaterThan(0)
      expect(credit.author.length).toBeGreaterThan(0)
      expect(credit.licenseUrl).toMatch(/^https:\/\//)
      expect(credit.sourceUrl).toMatch(/^https:\/\//)
    }
  })

  it('points every recording at an Ogg and an MP3 file', () => {
    for (const entry of Object.values(AMBIENCE_SAMPLES)) {
      expect(entry?.ogg).toMatch(/^\/audio\/ambient\/.+\.ogg$/)
      expect(entry?.mp3).toMatch(/^\/audio\/ambient\/.+\.mp3$/)
    }
  })

  it('exposes one credit row per recording', () => {
    const rows = getAmbienceSampleCreditRows()
    expect(rows.length).toBe(AMBIENCE_SAMPLE_CREDITS.length)
    for (const row of rows) {
      expect(row.name.length).toBeGreaterThan(0)
      expect(hasAmbienceSample(row.id)).toBe(true)
    }
  })
})

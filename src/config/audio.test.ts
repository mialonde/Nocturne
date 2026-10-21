import { describe, expect, it } from 'vitest'
import {
  clampBeat,
  clampCarrier,
  computeBinauralPair,
  getBreathCycleDuration,
  roundFrequency,
} from './audio'

describe('binaural pair', () => {
  it('keeps the carrier on the left and subtracts the beat on the right', () => {
    expect(computeBinauralPair(200, 10)).toEqual({ left: 200, right: 190, beat: 10 })
  })

  it('clamps the carrier to the supported 100–500 Hz field', () => {
    expect(clampCarrier(50)).toBe(100)
    expect(clampCarrier(900)).toBe(500)
    expect(computeBinauralPair(50, 10).left).toBe(100)
    expect(computeBinauralPair(900, 10).left).toBe(500)
  })

  it('clamps the beat to 0.5–40 Hz and preserves the difference', () => {
    expect(clampBeat(0.1)).toBe(0.5)
    expect(clampBeat(100)).toBe(40)
    const pair = computeBinauralPair(100, 100)
    expect(pair).toEqual({ left: 100, right: 60, beat: 40 })
    expect(pair.left - pair.right).toBeCloseTo(pair.beat, 8)
  })

  it('rounds both frequencies to hundredths of a hertz', () => {
    expect(roundFrequency(199.996)).toBe(200)
    expect(roundFrequency(178.224)).toBe(178.22)
    expect(computeBinauralPair(199.996, 10.004)).toEqual({
      left: 200,
      right: 189.99,
      beat: 10,
    })
  })
})

describe('breath timing', () => {
  it('sums all four phases', () => {
    expect(getBreathCycleDuration({ inhale: 4, hold: 2, exhale: 6, rest: 2 })).toBe(14)
    expect(getBreathCycleDuration({ inhale: 5, hold: 0, exhale: 5, rest: 0 })).toBe(10)
  })

  it('never returns a non-positive cycle', () => {
    expect(getBreathCycleDuration({ inhale: 0, hold: 0, exhale: 0, rest: 0 })).toBe(0.1)
  })
})

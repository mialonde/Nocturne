import { describe, expect, it } from 'vitest'
import { livingFactors } from './livingSoundscape'
describe('living soundscape sequence', () => {
  it('repeats by seed and event independently of track order', () => {
    expect(livingFactors(42, 3, 0.3, ['rain', 'wind'])).toEqual(livingFactors(42, 3, 0.3, ['wind', 'rain']))
    expect(livingFactors(42, 3, 0.3, ['rain'])).not.toEqual(livingFactors(43, 3, 0.3, ['rain']))
  })
  it('does not create new layers and respects variation bounds', () => {
    const factors = livingFactors(42, 1, 0.3, ['rain'])
    expect(Object.keys(factors)).toEqual(['rain'])
    expect(factors.rain).toBeGreaterThanOrEqual(0.7)
    expect(factors.rain).toBeLessThanOrEqual(1.3)
    expect(livingFactors(42, 1, 0, ['rain'])).toEqual({ rain: 1 })
  })
})

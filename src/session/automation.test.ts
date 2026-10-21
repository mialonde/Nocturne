import { describe, expect, it } from 'vitest'
import { automationFrame, normalizeAutomation } from './automation'
import { createStarterSession } from '../config/sessions'
import { parseSessionFile, serializeSession } from './sessionFile'

describe('passage automation', () => {
  it('interpolates and clamps progress without changing the original preferences', () => {
    const start = { intensity: 1, bloom: 1, cameraMotion: 1 }
    const target = { visualIntensityTo: 0.2, bloomTo: 0, ambientTo: 0.1, cameraMotionTo: 0 }
    expect(automationFrame(start, target, 0.5)).toEqual({ intensity: 0.6, bloom: 0.5, cameraMotion: 0.5 })
    expect(automationFrame(start, target, 2).intensity).toBeCloseTo(0.2)
    expect(start).toEqual({ intensity: 1, bloom: 1, cameraMotion: 1 })
  })
  it('preserves automation during session exchange and rejects malformed targets', () => {
    const session = createStarterSession()
    session.segments[0].automation = { visualIntensityTo: 0.4, bloomTo: 0.2, ambientTo: 0.3, cameraMotionTo: 0 }
    expect(parseSessionFile(serializeSession(session)).segments[0].automation).toEqual(session.segments[0].automation)
    expect(normalizeAutomation({ bloomTo: 'bad' })).toBeUndefined()
  })
})

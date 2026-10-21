import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '../audio/AudioEngine'
import { createEmptySegment } from '../config/sessions'
import type { SavedSession } from '../types'

vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const { useNocturneStore: store } = await import('../store/useNocturneStore')
const { SessionPlayer } = await import('./SessionPlayer')
const initial = store.getState()
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] })
  vi.stubGlobal('window', globalThis)
})
afterEach(() => { store.setState(initial); vi.useRealTimers(); vi.unstubAllGlobals() })

function audioMock() {
  return {
    start: vi.fn().mockResolvedValue(undefined), pause: vi.fn().mockResolvedValue(undefined),
    isPlaying: () => true, setSessionFade: vi.fn(), setSessionAmbientMultiplier: vi.fn(), setBinauralLadder: vi.fn(),
  } as unknown as AudioEngine
}
function session(profile: string): SavedSession {
  return { id: 'test-session', name: 'Test', note: '', createdAt: 0, updatedAt: 0,
    segments: [createEmptySegment({ durationSec: 10, ambientProfile: profile,
      automation: { visualIntensityTo: 0.2, bloomTo: 0, ambientTo: 0, cameraMotionTo: 0 } })] }
}

describe('session integration with optional features', () => {
  it('uses the chosen ambience and restores the prior mix without persisting visual automation', async () => {
    store.setState({ ambienceTrackVolumes: { ocean: 0.4 } })
    const originalVisuals = { ...store.getState().visuals }
    const onAutomation = vi.fn()
    const player = new SessionPlayer(audioMock(), onAutomation)
    await player.start(session('rain'))
    expect(store.getState().ambienceTrackVolumes).toHaveProperty('rain')
    vi.advanceTimersByTime(5000)
    const frame = onAutomation.mock.calls.at(-1)?.[0]
    expect(frame.intensity).toBeLessThan(originalVisuals.intensity)
    expect(frame.intensity).toBeGreaterThan(0.2)
    expect(store.getState().visuals).toEqual(originalVisuals)
    player.stop()
    expect(store.getState().ambienceTrackVolumes).toEqual({ ocean: 0.4 })
    expect(onAutomation).toHaveBeenLastCalledWith(null)
    player.dispose()
  })

  it('resolves a saved mix profile instead of silently retaining the preceding tracks', async () => {
    store.setState({ userMixes: [{ id: 'user_mix_test', name: 'Rain and wind', description: '',
      isPreset: false, tracks: { rain: 0.4, wind: 0.2 } }] })
    const player = new SessionPlayer(audioMock())
    await player.start(session('user_mix_test'))
    expect(store.getState().ambienceTrackVolumes).toEqual({ rain: 0.4, wind: 0.2 })
    player.stop(); player.dispose()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startSleepTimer } from './sleepTimer'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-21T00:00:00Z'))
  vi.stubGlobal('window', globalThis)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

const callbacks = () => ({
  scheduleFade: vi.fn(), resetFade: vi.fn(), onTick: vi.fn(), onExpire: vi.fn(),
})

describe('sleep timer lifecycle', () => {
  it('restores volume when cancelled during the final fade', () => {
    const cb = callbacks()
    const cancel = startSleepTimer(Date.now() + 30_000, cb)
    expect(cb.scheduleFade).toHaveBeenCalledWith(30)
    cancel()
    vi.advanceTimersByTime(60_000)
    expect(cb.resetFade).toHaveBeenCalledOnce()
    expect(cb.onExpire).not.toHaveBeenCalled()
  })

  it('cancels the old fade when extended and schedules the new final minute', () => {
    const cb = callbacks()
    const cancel = startSleepTimer(Date.now() + 30_000, cb)
    cancel()
    const cancelExtended = startSleepTimer(Date.now() + 120_000, cb)
    vi.advanceTimersByTime(60_000)
    expect(cb.scheduleFade.mock.calls).toEqual([[30], [60]])
    expect(cb.onExpire).not.toHaveBeenCalled()
    cancelExtended()
  })

  it('expires once and leaves fade restoration to the transport stop', () => {
    const cb = callbacks()
    const cancel = startSleepTimer(Date.now() + 1000, cb)
    vi.advanceTimersByTime(5000)
    cancel()
    expect(cb.onExpire).toHaveBeenCalledOnce()
    expect(cb.resetFade).not.toHaveBeenCalled()
  })
})

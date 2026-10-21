import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearMediaSession, createMediaTransport, updateMediaSession } from './mediaSession'

afterEach(() => vi.unstubAllGlobals())
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('hardware playback commands', () => {
  it('treats repeated play and pause as explicit states', async () => {
    let playing = false
    const toggle = vi.fn(async () => { playing = !playing })
    const transport = createMediaTransport(() => playing, toggle, vi.fn(), vi.fn())
    transport.onPlay()
    transport.onPlay()
    await flush()
    expect(playing).toBe(true)
    expect(toggle).toHaveBeenCalledTimes(1)
    transport.onPause()
    transport.onPause()
    await flush()
    expect(playing).toBe(false)
    expect(toggle).toHaveBeenCalledTimes(2)
  })

  it('honours pause received while playback is starting', async () => {
    let playing = false
    let finish!: () => void
    const toggle = vi.fn(async () => {
      if (!playing) await new Promise<void>((resolve) => { finish = resolve })
      playing = !playing
    })
    const transport = createMediaTransport(() => playing, toggle, vi.fn(), vi.fn())
    transport.onPlay()
    await flush()
    transport.onPause()
    finish()
    await flush()
    expect(playing).toBe(false)
    expect(toggle).toHaveBeenCalledTimes(2)
  })

  it('can process commands again after a failed command', async () => {
    const error = vi.fn()
    const toggle = vi.fn().mockRejectedValueOnce(new Error('blocked')).mockResolvedValue(undefined)
    const stop = vi.fn()
    const transport = createMediaTransport(() => false, toggle, stop, error)
    transport.onPlay()
    transport.onStop()
    await flush()
    expect(error).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledOnce()
  })
})

describe('media session integration', () => {
  it('ignores unsupported actions and clears handlers on stop', () => {
    const setActionHandler = vi.fn((action: string) => {
      if (action === 'stop') throw new Error('unsupported')
    })
    const session = { setActionHandler, setPositionState: vi.fn(), metadata: null, playbackState: 'none' }
    vi.stubGlobal('navigator', { mediaSession: session })
    vi.stubGlobal('MediaMetadata', class { constructor(data: object) { Object.assign(this, data) } })
    const transport = { onPlay: vi.fn(), onPause: vi.fn(), onStop: vi.fn() }
    expect(() => updateMediaSession({
      title: 'Room', artist: 'NOCTURNE', album: 'Dusk', playing: false,
      positionMs: 0, durationMs: 0, seekable: false,
    }, transport)).not.toThrow()
    expect(session.playbackState).toBe('paused')
    expect(setActionHandler).toHaveBeenCalledWith('pause', expect.any(Function))
    clearMediaSession()
    expect(session.metadata).toBeNull()
    expect(session.playbackState).toBe('none')
    expect(setActionHandler).toHaveBeenCalledWith('play', null)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { SampleLibrary } from './SampleLibrary'

function createContext() {
  const decoded = {
    length: 48000,
    numberOfChannels: 1,
    sampleRate: 48000,
    duration: 1,
  }
  return {
    decodeAudioData: vi.fn(async () => decoded),
  } as unknown as AudioContext
}

const okResponse = (payload = new ArrayBuffer(8)) =>
  ({
    ok: true,
    status: 200,
    arrayBuffer: async () => payload,
  }) as unknown as Response

describe('SampleLibrary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('decodes a recording and keeps it in memory', async () => {
    const context = createContext()
    vi.stubGlobal('fetch', vi.fn(async () => okResponse()))

    const library = new SampleLibrary(context)
    const buffer = await library.load('rain')

    expect(buffer).not.toBeNull()
    expect(library.isReady('rain')).toBe(true)
    expect(library.peek('rain')).toBe(buffer)
  })

  it('serves the second request from the cache', async () => {
    const context = createContext()
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)

    const library = new SampleLibrary(context)
    await library.load('rain')
    await library.load('rain')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shares one request between concurrent callers', async () => {
    const context = createContext()
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)

    const library = new SampleLibrary(context)
    const [a, b] = await Promise.all([library.load('wind'), library.load('wind')])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
  })

  it('resolves to null when the file cannot be fetched', async () => {
    const context = createContext()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )

    const library = new SampleLibrary(context)
    const buffer = await library.load('rain')

    expect(buffer).toBeNull()
    expect(library.hasFailed('rain')).toBe(true)
  })

  it('tries the next format when a file cannot be decoded', async () => {
    const context = {
      decodeAudioData: vi.fn(async () => {
        throw new Error('unsupported container')
      }),
    } as unknown as AudioContext
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)

    const library = new SampleLibrary(context)
    const buffer = await library.load('rain')

    expect(buffer).toBeNull()
    // The Ogg file and the MP3 fallback were both attempted.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry a recording that already failed', async () => {
    const context = createContext()
    const fetchMock = vi.fn(async () => {
      throw new Error('network down')
    })
    vi.stubGlobal('fetch', fetchMock)

    const library = new SampleLibrary(context)
    await library.load('rain')
    // The first attempt tries the Ogg file and the MP3 fallback.
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await library.load('rain')
    // The second attempt is not repeated.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

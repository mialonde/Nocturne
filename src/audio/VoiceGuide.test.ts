import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from './AudioEngine'
import { VoiceGuide } from './VoiceGuide'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  vi.stubGlobal('window', globalThis)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 5))
function setup(ready = true, decode = vi.fn().mockResolvedValue({ duration: 5 })) {
  const audio = {
    isGuidancePlaying: () => false, isPlaying: () => true,
    getContext: () => ({ decodeAudioData: decode }),
    playGuidance: vi.fn(), stopGuidance: vi.fn(),
  }
  const fetch = vi.fn(async (url: string) => url.includes('manifest.json')
    ? new Response(JSON.stringify({ version: 1, profiles: { sleep: ready, focus: ready, meditation: ready } }), { headers: { 'content-type': 'application/json' } })
    : new Response('audio', { headers: { 'content-type': 'audio/mpeg' } }))
  vi.stubGlobal('fetch', fetch)
  return { guide: new VoiceGuide(audio as unknown as AudioEngine), audio, fetch, decode }
}
describe('recorded guidance profiles', () => {
  it('plays the three scheduled cues once through the master bus', async () => {
    const { guide, audio, fetch } = setup()
    const error = vi.fn()
    guide.configure('sleep', error)
    guide.setVolume(0.3)
    guide.resume()
    await flush()
    expect(audio.playGuidance).toHaveBeenCalledWith({ duration: 5 }, 0.3)
    for (const seconds of [120, 180]) {
      await vi.advanceTimersByTimeAsync(seconds * 1000)
      await flush()
    }
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/audio/guidance/manifest.json', '/audio/guidance/sleep/settle.mp3',
      '/audio/guidance/sleep/release.mp3', '/audio/guidance/sleep/let-go.mp3',
    ])
    expect(audio.playGuidance).toHaveBeenCalledTimes(3)
    expect(error).not.toHaveBeenCalled()
    guide.stop()
  })
  it('reports an unproduced profile without pretending it has narration', async () => {
    const { guide, audio, fetch } = setup(false)
    const error = vi.fn()
    guide.configure('focus', error)
    guide.resume()
    await flush()
    expect(error).toHaveBeenCalledOnce()
    expect(audio.playGuidance).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledOnce()
    guide.stop()
  })
  it('does not play a late decode after being stopped', async () => {
    let finish!: (buffer: { duration: number }) => void
    const { guide, audio, decode } = setup(true, vi.fn(() => new Promise((resolve) => { finish = resolve })))
    guide.configure('meditation', vi.fn())
    guide.resume()
    await flush()
    expect(decode).toHaveBeenCalledOnce()
    guide.stop()
    finish({ duration: 5 })
    await flush()
    expect(audio.playGuidance).not.toHaveBeenCalled()
  })
  it('does not decode an HTML fallback served at an absent audio URL', async () => {
    const { guide, audio, fetch } = setup()
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ version: 1, profiles: { sleep: true } })))
      .mockResolvedValueOnce(new Response('<html></html>', { headers: { 'content-type': 'text/html' } }))
    const error = vi.fn()
    guide.configure('sleep', error)
    guide.resume()
    await flush()
    expect(error).toHaveBeenCalledOnce()
    expect(audio.playGuidance).not.toHaveBeenCalled()
    guide.stop()
  })
})

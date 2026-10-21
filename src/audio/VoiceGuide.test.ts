import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from './AudioEngine'
import { VoiceGuide } from './VoiceGuide'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
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
  it('plays the arrival once, then cycles reminders through the master bus', async () => {
    const { guide, audio, fetch } = setup()
    const error = vi.fn()
    guide.start('sleep', 0.3, 30, error)
    await flush()
    expect(audio.playGuidance).toHaveBeenCalledWith({ duration: 5 }, 0.3)
    for (let index = 0; index < 3; index++) {
      await vi.advanceTimersByTimeAsync(30_000)
      await flush()
    }
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/audio/guidance/manifest.json', '/audio/guidance/sleep/settle.mp3',
      '/audio/guidance/sleep/release.mp3', '/audio/guidance/sleep/let-go.mp3',
    ])
    expect(audio.playGuidance).toHaveBeenCalledTimes(4)
    expect(error).not.toHaveBeenCalled()
    guide.stop()
  })
  it('reports an unproduced profile without pretending it has narration', async () => {
    const { guide, audio, fetch } = setup(false)
    const error = vi.fn()
    guide.start('focus', 0.5, 60, error)
    await flush()
    expect(error).toHaveBeenCalledOnce()
    expect(audio.playGuidance).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledOnce()
    guide.stop()
  })
  it('does not play a late decode after being stopped', async () => {
    let finish!: (buffer: { duration: number }) => void
    const { guide, audio, decode } = setup(true, vi.fn(() => new Promise((resolve) => { finish = resolve })))
    guide.start('meditation', 0.5, 60, vi.fn())
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
    guide.start('sleep', 0.5, 60, error)
    await flush()
    expect(error).toHaveBeenCalledOnce()
    expect(audio.playGuidance).not.toHaveBeenCalled()
    guide.stop()
  })
})

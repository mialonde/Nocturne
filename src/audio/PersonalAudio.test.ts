import { describe, expect, it, vi } from 'vitest'
import { AudioEngine } from './AudioEngine'
import type { AudioSettings } from '../types'

function setup(decode = vi.fn().mockResolvedValue({ duration: 2 })) {
  const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }[] = []
  const context = {
    state: 'running', decodeAudioData: decode,
    createBufferSource: () => {
      const source = { start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn() }
      sources.push(source)
      return source
    },
  }
  const audio = new AudioEngine({ layers: {} } as AudioSettings, 'dusk', 'dusk')
  vi.spyOn(audio as unknown as { ensureGraph: () => Promise<unknown> }, 'ensureGraph').mockResolvedValue(context)
  return { audio, sources }
}
describe('personal audio lifecycle', () => {
  it('replaces a loop without leaving the old source connected', async () => {
    const { audio, sources } = setup()
    await audio.loadPersonalAudio(new Blob(['one']))
    await audio.loadPersonalAudio(new Blob(['two']))
    expect(sources[0].stop).toHaveBeenCalledOnce()
    expect(sources[0].disconnect).toHaveBeenCalledOnce()
    expect(sources[1].start).toHaveBeenCalledOnce()
    audio.clearPersonalAudio()
    expect(audio.hasPersonalAudio()).toBe(false)
    expect(sources[1].stop).toHaveBeenCalledOnce()
  })
  it('does not resurrect a removed file after a late decode', async () => {
    let finish!: (buffer: { duration: number }) => void
    const { audio, sources } = setup(vi.fn(() => new Promise((resolve) => { finish = resolve })))
    const loading = audio.loadPersonalAudio(new Blob(['pending']))
    await new Promise((resolve) => setTimeout(resolve, 0))
    audio.clearPersonalAudio()
    finish({ duration: 2 })
    await loading
    expect(sources).toHaveLength(0)
    expect(audio.hasPersonalAudio()).toBe(false)
  })
  it('rejects loops longer than ten minutes', async () => {
    const { audio, sources } = setup(vi.fn().mockResolvedValue({ duration: 601 }))
    await expect(audio.loadPersonalAudio(new Blob(['long']))).rejects.toThrow('10 minutes')
    expect(sources).toHaveLength(0)
  })
})

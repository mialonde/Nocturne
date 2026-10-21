import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { localTurkishVoice, VoiceGuide } from './VoiceGuide'
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('window', globalThis) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
function setup(voices = [{ lang: 'tr-TR', localService: true }]) {
  const synth = { getVoices: () => voices, speak: vi.fn(), cancel: vi.fn() }
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    text: string
    constructor(text: string) { this.text = text }
  })
  return synth
}
describe('local Turkish voice guidance', () => {
  it('never selects a remote voice or substitutes another language', () => {
    setup([{ lang: 'tr-TR', localService: false }, { lang: 'en-US', localService: true }])
    expect(localTurkishVoice()).toBeNull()
    const guide = new VoiceGuide()
    expect(guide.speak(0.5)).toBe(false)
    guide.stop()
  })
  it('speaks at the requested volume and stops scheduled prompts', () => {
    const synth = setup()
    const guide = new VoiceGuide()
    guide.start(0.3, 30)
    expect(synth.speak).toHaveBeenCalledOnce()
    const utterance = synth.speak.mock.calls[0][0] as unknown as SpeechSynthesisUtterance
    expect(utterance.volume).toBe(0.3)
    expect(utterance.lang).toBe('tr-TR')
    guide.stop()
    vi.advanceTimersByTime(120_000)
    expect(synth.speak).toHaveBeenCalledOnce()
    expect(synth.cancel).toHaveBeenCalledOnce()
  })
})

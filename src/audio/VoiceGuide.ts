import type { AudioEngine } from './AudioEngine'
import { GUIDANCE_PROFILES, guidanceAvailability, guidanceClipPath, type GuidanceProfileId } from '../config/guidance'

/** Plays bundled narration through the same master and recording bus as the room. */
export class VoiceGuide {
  private timer: number | null = null
  private generation = 0
  private request: AbortController | null = null
  private readonly buffers = new Map<string, AudioBuffer>()
  constructor(private readonly audio: AudioEngine) {}

  start(profile: GuidanceProfileId, volume: number, everySec: number, onError: (error: unknown) => void): void {
    this.stop()
    const generation = this.generation
    const controller = new AbortController()
    this.request = controller
    let index = 0
    let loading = false
    const clips = GUIDANCE_PROFILES[profile].clips
    const play = async () => {
      if (loading || this.audio.isGuidancePlaying()) return
      loading = true
      try {
        const clip = clips[index]
        const path = guidanceClipPath(profile, clip.id)
        let buffer = this.buffers.get(path)
        if (!buffer) {
          const response = await fetch(path, { signal: controller.signal })
          if (!response.ok || response.headers.get('content-type')?.includes('text/html')) {
            throw new Error('This guidance recording has not been added yet.')
          }
          const context = this.audio.getContext()
          if (!context) throw new Error('Audio is not ready.')
          buffer = await context.decodeAudioData(await response.arrayBuffer())
          if (buffer.duration > 120) throw new Error('Guidance clips must be shorter than two minutes.')
          if (generation !== this.generation) return
          this.buffers.set(path, buffer)
        }
        if (generation !== this.generation || !this.audio.isPlaying()) return
        this.audio.playGuidance(buffer, volume)
        // The arrival plays once; subsequent reminders rotate without repeating it.
        index = index + 1 < clips.length ? index + 1 : 1
      } catch (error) {
        if (generation !== this.generation || controller.signal.aborted) return
        this.stop()
        onError(error)
      } finally { loading = false }
    }
    void guidanceAvailability(controller.signal).then(async (available) => {
      if (generation !== this.generation) return
      if (!available[profile]) throw new Error('This guidance recording has not been added yet.')
      this.timer = window.setInterval(() => void play(), Math.max(30, everySec) * 1000)
      await play()
    }).catch((error) => {
      if (generation !== this.generation || controller.signal.aborted) return
      this.stop(); onError(error)
    })
  }

  stop(): void {
    this.generation += 1
    this.request?.abort()
    this.request = null
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.audio.stopGuidance()
  }
}

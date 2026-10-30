import type { AudioEngine } from './AudioEngine'
import { GUIDANCE_PROFILES, guidanceAvailability, guidanceClipPath, type GuidanceProfileId } from '../config/guidance'

/** Plays scheduled, bundled narration through the room's shared audio bus. */
export class VoiceGuide {
  private timer: number | null = null
  private generation = 0
  private request: AbortController | null = null
  private readonly buffers = new Map<string, AudioBuffer>()
  private profile: GuidanceProfileId | null = null
  private volume = 0.5
  private onError: (error: unknown) => void = () => undefined
  private elapsedMs = 0
  private resumedAt: number | null = null
  private nextIndex = 0
  private loading = false

  constructor(private readonly audio: AudioEngine) {}

  configure(profile: GuidanceProfileId, onError: (error: unknown) => void): void {
    this.stop()
    this.profile = profile
    this.onError = onError
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
  }

  resume(): void {
    if (!this.profile || this.timer !== null) return
    this.resumedAt = Date.now()
    const generation = ++this.generation
    const controller = new AbortController()
    this.request = controller
    this.timer = window.setInterval(() => void this.playDueClip(generation, controller), 500)
    void guidanceAvailability(controller.signal).then((available) => {
      if (generation !== this.generation) return
      if (!available[this.profile!]) throw new Error('This guidance recording has not been added yet.')
      return this.playDueClip(generation, controller)
    }).catch((error) => this.fail(error, generation, controller))
  }

  pause(): void {
    if (this.resumedAt !== null) {
      this.elapsedMs += Date.now() - this.resumedAt
      this.resumedAt = null
    }
    this.generation += 1
    this.request?.abort()
    this.request = null
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.loading = false
    this.audio.stopGuidance()
  }

  stop(): void {
    this.pause()
    this.profile = null
    this.elapsedMs = 0
    this.nextIndex = 0
  }

  private async playDueClip(generation: number, controller: AbortController): Promise<void> {
    if (this.loading || !this.profile || !this.audio.isPlaying() || this.audio.isGuidancePlaying()) return
    const clips = GUIDANCE_PROFILES[this.profile].clips
    const clip = clips[this.nextIndex]
    if (!clip) {
      if (this.timer !== null) window.clearInterval(this.timer)
      this.timer = null
      return
    }
    const elapsedMs = this.elapsedMs + (this.resumedAt === null ? 0 : Date.now() - this.resumedAt)
    if (elapsedMs < clip.atSec * 1000) return

    this.loading = true
    try {
      const path = guidanceClipPath(this.profile, clip.id)
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
      // If an earlier clip ran long, wait for it to finish before starting this one.
      if (this.audio.isGuidancePlaying()) return
      this.audio.playGuidance(buffer, this.volume)
      this.nextIndex += 1
    } catch (error) {
      this.fail(error, generation, controller)
    } finally {
      if (generation === this.generation) this.loading = false
    }
  }

  private fail(error: unknown, generation: number, controller: AbortController): void {
    if (generation !== this.generation || controller.signal.aborted) return
    this.stop()
    this.onError(error)
  }
}

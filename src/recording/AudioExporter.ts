import type { AudioEngine } from '../audio/AudioEngine'
import { encodeWav } from './wav'

export type AudioExportPhase = 'idle' | 'recording' | 'processing' | 'ready' | 'error'

export interface AudioExportResult {
  url: string
  blob: Blob
  fileName: string
  durationMs: number
  bytes: number
}

export interface AudioExportSnapshot {
  phase: AudioExportPhase
  elapsedMs: number
  error: string | null
  result: AudioExportResult | null
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

export function chooseAudioMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  if (typeof MediaRecorder.isTypeSupported !== 'function') return null
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate
  }
  return null
}

function idleSnapshot(): AudioExportSnapshot {
  return { phase: 'idle', elapsedMs: 0, error: null, result: null }
}

function safeFileName(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19)
  return `nocturne_${stamp}_stereo.wav`
}

/**
 * Records the master bus without the picture and hands it back as a WAV
 * file. The tap is after the limiter; the browser's compressed recording
 * is decoded to PCM, rather than captured losslessly from the original bus.
 */
export class AudioExporter {
  private readonly audio: AudioEngine
  private readonly listeners = new Set<() => void>()
  private snapshot: AudioExportSnapshot = idleSnapshot()
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private timer: number | null = null
  private startedAt = 0
  private accumulatedMs = 0
  private disposed = false
  private stopping = false
  private generation = 0

  constructor(audio: AudioEngine) {
    this.audio = audio
  }

  readonly getSnapshot = (): AudioExportSnapshot => this.snapshot

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(patch: Partial<AudioExportSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }

  async start(): Promise<void> {
    if (this.disposed) return
    if (this.snapshot.phase === 'recording' || this.snapshot.phase === 'processing') return

    const stream = this.audio.getMediaStream()
    const track = stream?.getAudioTracks()[0]
    if (!track) {
      this.emit({
        phase: 'error',
        error: 'The audio bus is not ready yet.',
      })
      return
    }

    const mimeType = chooseAudioMimeType()
    if (!mimeType) {
      this.emit({
        phase: 'error',
        error: 'This browser cannot record audio on its own.',
      })
      return
    }

    this.discard()
    const generation = this.generation
    this.chunks = []
    this.accumulatedMs = 0
    this.stopping = false
    try {
      const recorder = new MediaRecorder(stream, { mimeType })
      this.recorder = recorder
      recorder.addEventListener('dataavailable', (event) => {
        if (this.disposed || generation !== this.generation) return
        if (event.data && event.data.size > 0) this.chunks.push(event.data)
      })
      recorder.addEventListener('stop', () => {
        if (this.disposed || generation !== this.generation) return
        if (!this.stopping) {
          this.accumulatedMs = this.elapsed()
          this.startedAt = 0
        }
        void this.finalize(generation, recorder.mimeType || mimeType)
      })
      recorder.addEventListener('error', () => {
        if (this.disposed || generation !== this.generation) return
        this.discard()
        this.emit({ phase: 'error', error: 'The audio recorder failed.' })
      })
      recorder.start(1000)
    } catch (error) {
      this.discard()
      this.emit({
        phase: 'error',
        error: error instanceof Error ? error.message : 'The audio recording could not start.',
      })
      return
    }

    this.startedAt = performance.now()
    this.emit({ phase: 'recording', elapsedMs: 0, error: null, result: null })
    this.timer = window.setInterval(() => {
      if (this.snapshot.phase !== 'recording') return
      this.emit({ elapsedMs: this.elapsed() })
    }, 500)
  }

  async stop(): Promise<void> {
    if (this.snapshot.phase !== 'recording') return
    if (this.stopping) return
    this.stopping = true
    this.accumulatedMs = this.elapsed()
    this.startedAt = 0
    this.stopTimer()
    this.emit({ phase: 'processing', elapsedMs: this.accumulatedMs })
    const recorder = this.recorder
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      return
    }
    await this.finalize(this.generation, recorder?.mimeType || 'audio/webm')
  }

  discard(): void {
    this.generation += 1
    this.stopTimer()
    const recorder = this.recorder
    this.recorder = null
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop()
    } catch {
      // The platform may already have stopped the recorder.
    }
    const result = this.snapshot.result
    if (result) URL.revokeObjectURL(result.url)
    this.chunks = []
    this.startedAt = 0
    this.accumulatedMs = 0
    this.stopping = false
    this.emit(idleSnapshot())
  }

  dispose(): void {
    this.disposed = true
    this.discard()
    this.listeners.clear()
  }

  private elapsed(): number {
    if (this.startedAt === 0) return this.accumulatedMs
    return this.accumulatedMs + (performance.now() - this.startedAt)
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * Turns the recorded stream into a WAV file. The browser encodes the
   * stream first; this conversion does not restore information lost by the codec.
   */
  private async finalize(generation: number, mimeType: string): Promise<void> {
    if (this.disposed || generation !== this.generation) return
    this.stopTimer()
    this.recorder = null
    const chunks = this.chunks
    this.chunks = []
    if (chunks.length === 0) {
      this.emit({ phase: 'error', error: 'The audio recording was empty.' })
      return
    }

    this.emit({ phase: 'processing' })
    try {
      const source = new Blob(chunks, { type: mimeType })
      const payload = await source.arrayBuffer()
      if (this.disposed || generation !== this.generation) return
      const context = this.audio.getContext()
      if (!context) {
        this.emit({ phase: 'error', error: 'The audio context is not available.' })
        return
      }
      const decoded = await context.decodeAudioData(payload)
      if (this.disposed || generation !== this.generation) return
      const wav = encodeWav(decoded)
      const result: AudioExportResult = {
        url: URL.createObjectURL(wav),
        blob: wav,
        fileName: safeFileName(),
        durationMs: Math.round(decoded.duration * 1000),
        bytes: wav.size,
      }
      this.emit({ phase: 'ready', result, elapsedMs: result.durationMs, error: null })
    } catch (error) {
      if (this.disposed || generation !== this.generation) return
      this.emit({
        phase: 'error',
        error:
          error instanceof Error
            ? `The audio file could not be prepared: ${error.message}`
            : 'The audio file could not be prepared.',
      })
    }
  }
}

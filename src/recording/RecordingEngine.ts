import type { AudioEngine } from '../audio/AudioEngine'
import type { Environment3D } from '../three/Environment3D'
import { stampWebmDurationBlob } from './webmDuration'
import type {
  RecordingResult,
  RecordingSettings,
  RecordingSupport,
} from '../types'

export type RecordingPhase =
  | 'idle'
  | 'preparing'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'ready'
  | 'error'

export interface RecordingSnapshot {
  phase: RecordingPhase
  elapsedMs: number
  bytes: number
  mimeType: string | null
  formatLabel: string
  fileName: string
  width: number
  height: number
  fps: number
  hasAudio: boolean
  pausedSupported: boolean
  error: string | null
  notice: string | null
  result: RecordingResult | null
}

const WEBM_CANDIDATES_AUDIO = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

const WEBM_CANDIDATES_VIDEO = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

function mimeCandidates(includeAudio: boolean): string[] {
  return includeAudio ? WEBM_CANDIDATES_AUDIO : WEBM_CANDIDATES_VIDEO
}

export function describeMimeType(mimeType: string): string {
  const lower = mimeType.toLowerCase()
  if (!lower.includes('webm')) return mimeType
  const video = lower.includes('vp9') ? 'VP9' : lower.includes('vp8') ? 'VP8' : 'WebM'
  const audio = lower.includes('opus') ? 'Opus stereo' : lower.includes('audio') ? 'Audio' : ''
  return audio ? `WebM · ${video} · ${audio}` : `WebM · ${video}`
}

export function chooseSupportedMimeType(includeAudio: boolean): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  if (typeof MediaRecorder.isTypeSupported !== 'function') return null
  for (const candidate of mimeCandidates(includeAudio)) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate
  }
  return null
}

export function getRecordingSupport(includeAudio: boolean): RecordingSupport {
  const captureSupported =
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  const mediaRecorderSupported =
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function'
  const audioContextSupported = typeof window !== 'undefined' && typeof window.AudioContext !== 'undefined'
  const mimeType = mediaRecorderSupported ? chooseSupportedMimeType(includeAudio) : null

  let reason: string | null = null
  if (!captureSupported) {
    reason = 'This browser cannot capture a WebGL canvas as a video stream.'
  } else if (!mediaRecorderSupported) {
    reason = 'MediaRecorder is not available in this browser.'
  } else if (!audioContextSupported && includeAudio) {
    reason = 'The Web Audio API is unavailable, so audio cannot be included.'
  } else if (!mimeType) {
    reason =
      'No supported WebM encoder was found. Native MP4 recording is intentionally not claimed. Try a current Chromium-based browser.'
  }
  return {
    supported: reason === null,
    captureSupported,
    audioContextSupported,
    mediaRecorderSupported,
    mimeType,
    label: mimeType ? describeMimeType(mimeType) : 'Unavailable',
    reason,
  }
}

function snapshotIdle(): RecordingSnapshot {
  return {
    phase: 'idle',
    elapsedMs: 0,
    bytes: 0,
    mimeType: null,
    formatLabel: '',
    fileName: '',
    width: 0,
    height: 0,
    fps: 30,
    hasAudio: true,
    pausedSupported: true,
    error: null,
    notice: null,
    result: null,
  }
}

function computeCaptureSize(
  aspect: RecordingSettings['aspect'],
  resolution: RecordingSettings['resolution'],
): { width: number; height: number } {
  const landscape = {
    720: { width: 1280, height: 720 },
    1080: { width: 1920, height: 1080 },
    1440: { width: 2560, height: 1440 },
  }[resolution]
  if (aspect === '16:9') return { ...landscape }
  if (aspect === '9:16') return { width: landscape.height, height: landscape.width }
  return { width: landscape.height, height: landscape.height }
}

function bitrateFor(settings: RecordingSettings): number {
  const base =
    settings.resolution === 720 ? 4_500_000 : settings.resolution === 1080 ? 9_000_000 : 16_000_000
  const qualityMultiplier = settings.quality === 'high' ? 1 : settings.quality === 'balanced' ? 0.72 : 0.5
  const fpsMultiplier = settings.fps === 60 ? 1.5 : 1
  return Math.round(base * qualityMultiplier * fpsMultiplier)
}

function safeFileName(settings: RecordingSettings): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19)
  const aspect = settings.aspect.replace(':', 'x')
  const audio = settings.includeAudio ? 'stereo' : 'silent'
  return `nocturne_${stamp}_${aspect}_${settings.resolution}p_${audio}.webm`
}

export class RecordingEngine {
  private readonly audio: AudioEngine
  private readonly getEnvironment: () => Environment3D | null
  private readonly listeners = new Set<() => void>()
  private snapshot: RecordingSnapshot = snapshotIdle()
  private recorder: MediaRecorder | null = null
  private combinedStream: MediaStream | null = null
  private captureStarted = false
  private chunks: Blob[] = []
  private mimeType: string | null = null
  private timer: number | null = null
  private activeStart: number | null = null
  private accumulatedMs = 0
  private disposed = false
  private currentSettings: RecordingSettings | null = null
  private finalizeGuard = 0
  private stopping = false
  private interruptedTake = false
  private readonly warmedEncoders = new Set<string>()

  constructor(audio: AudioEngine, getEnvironment: () => Environment3D | null) {
    this.audio = audio
    this.getEnvironment = getEnvironment
    window.addEventListener('pagehide', this.handlePageHide)
    window.addEventListener('pageshow', this.handlePageShow)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  readonly getSnapshot = (): RecordingSnapshot => this.snapshot

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(patch: Partial<RecordingSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }

  private elapsed(): number {
    if (this.activeStart === null) return this.accumulatedMs
    return this.accumulatedMs + (performance.now() - this.activeStart)
  }

  private startTimer(): void {
    this.stopTimer()
    this.timer = window.setInterval(() => {
      if (this.snapshot.phase !== 'recording') return
      this.emit({ elapsedMs: this.elapsed() })
    }, 500)
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * The first MediaRecorder at a given size can spend over a second
   * initializing the platform VP9 encoder. During that window the capture
   * stream advances but no video packets are written, producing a frozen,
   * A/V-desynchronised opening. Feeding a throwaway canvas through the same
   * encoder and size once removes that start-up gap; subsequent takes reuse
   * the warm encoder resources. Nothing from this canvas is kept or exposed.
   */
  private async warmEncoder(
    width: number,
    height: number,
    mimeType: string,
    fps: number,
    videoBitsPerSecond: number,
  ): Promise<void> {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return
    if (!MediaRecorder.isTypeSupported(mimeType)) return
    const key = `${mimeType}|${width}x${height}|${fps}`
    if (this.warmedEncoders.has(key)) return
    this.warmedEncoders.add(key)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    let stream: MediaStream | null = null
    let interval = 0
    let succeeded = false
    try {
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) throw new Error('No 2D context for encoder warm-up.')
      stream = canvas.captureStream(fps)
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond })
      const stopped = new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true })
      })
      recorder.start(1000)
      let tick = 0
      const draw = () => {
        const progress = tick / Math.max(1, fps)
        const hue = (progress * 40) % 360
        const gradient = context.createLinearGradient(0, 0, width, height)
        gradient.addColorStop(0, `hsl(${220 + Math.sin(progress) * 15} 48% 7%)`)
        gradient.addColorStop(1, `hsl(${hue + 255} 38% 18%)`)
        context.fillStyle = gradient
        context.fillRect(0, 0, width, height)
        context.fillStyle = `hsla(${hue + 30} 70% 70% / 0.45)`
        context.beginPath()
        context.arc(
          width * (0.5 + Math.sin(progress * 0.9) * 0.18),
          height * (0.5 + Math.cos(progress * 0.7) * 0.14),
          Math.min(width, height) * 0.16,
          0,
          Math.PI * 2,
        )
        context.fill()
        tick += 1
      }
      draw()
      interval = window.setInterval(draw, Math.max(16, Math.round(1000 / fps)))
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 1400)
      })
      if (recorder.state !== 'inactive') recorder.stop()
      await Promise.race([
        stopped,
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 800)
        }),
      ])
      // Give the platform encoder a beat to flush before the real stream opens.
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 180)
      })
      succeeded = true
    } catch (error) {
      console.warn('Nocturne: video encoder warm-up failed; recording will still be attempted.', error)
    } finally {
      if (interval) window.clearInterval(interval)
      stream?.getTracks().forEach((track) => track.stop())
      canvas.width = 1
      canvas.height = 1
      if (!succeeded) this.warmedEncoders.delete(key)
    }
  }

  async start(settings: RecordingSettings): Promise<void> {
    if (this.disposed) return
    if (this.snapshot.phase === 'recording' || this.snapshot.phase === 'paused' || this.snapshot.phase === 'preparing') {
      return
    }
    this.interruptedTake = false
    this.discardResult()
    this.currentSettings = { ...settings }
    const environment = this.getEnvironment()
    if (!environment) {
      this.failBeforeStart('The 3D environment is not ready yet.')
      return
    }
    const support = getRecordingSupport(settings.includeAudio)
    if (!support.supported) {
      this.failBeforeStart(support.reason ?? 'Recording is not supported in this browser.')
      return
    }

    this.chunks = []
    this.accumulatedMs = 0
    this.activeStart = null
    this.stopping = false
    const { width, height } = computeCaptureSize(settings.aspect, settings.resolution)
    this.emit({
      ...snapshotIdle(),
      phase: 'preparing',
      width,
      height,
      fps: settings.fps,
      hasAudio: settings.includeAudio,
      formatLabel: support.label,
      fileName: safeFileName(settings),
      error: null,
      notice: null,
    })

    let captureStream: MediaStream | null = null
    try {
      const candidates = mimeCandidates(settings.includeAudio).filter((mime) =>
        typeof MediaRecorder.isTypeSupported === 'function'
          ? MediaRecorder.isTypeSupported(mime)
          : false,
      )
      if (candidates.length === 0) {
        throw new Error('No supported WebM codec was found.')
      }
      await this.warmEncoder(width, height, candidates[0], settings.fps, bitrateFor(settings))
      if (this.disposed || this.interruptedTake) return

      if (settings.includeAudio) {
        this.audio.setRecordingKeepAlive(true)
        const track = this.audio.getAudioTrack()
        if (!track) {
          throw new Error(
            'Audio is not initialized yet. Begin the experience or turn off audio capture before recording.',
          )
        }
      }

      const captureHandle = environment.startCapture({
        aspect: settings.aspect,
        resolution: settings.resolution,
        fps: settings.fps,
        includeOverlay: !settings.cleanCapture,
      })
      this.captureStarted = true
      captureStream = captureHandle.stream
      const videoTrack = captureStream.getVideoTracks()[0]
      if (!videoTrack) {
        throw new Error('The capture surface did not produce a video track.')
      }

      const audioTrack = settings.includeAudio ? this.audio.getAudioTrack() : null
      if (settings.includeAudio && !audioTrack) {
        throw new Error('The stereo master audio track is unavailable.')
      }
      const tracks: MediaStreamTrack[] = [videoTrack]
      if (audioTrack) tracks.push(audioTrack)
      const combined = new MediaStream(tracks)
      this.combinedStream = combined

      let recorder: MediaRecorder | null = null
      let lastError: unknown = null
      for (const candidate of candidates) {
        try {
          const attempt = new MediaRecorder(combined, {
            mimeType: candidate,
            videoBitsPerSecond: bitrateFor(settings),
            audioBitsPerSecond: settings.includeAudio ? 192_000 : undefined,
          })
          this.attachRecorderHandlers(attempt, settings)
          attempt.start(1000)
          if (attempt.state === 'inactive') {
            throw new Error('The encoder stopped immediately.')
          }
          recorder = attempt
          this.mimeType = attempt.mimeType || candidate
          break
        } catch (error) {
          lastError = error
          try {
            this.clearRecorderHandlers(recorder)
          } catch {
            // Ignore cleanup failures while trying the next codec.
          }
        }
      }
      if (!recorder) {
        const message =
          lastError instanceof Error ? lastError.message : 'No supported encoder accepted the stream.'
        throw new Error(`The browser could not start a WebM encoder: ${message}`)
      }

      this.recorder = recorder
      this.pausedSupported = typeof recorder.pause === 'function' && typeof recorder.resume === 'function'
      this.activeStart = performance.now()
      this.startTimer()
      this.emit({
        phase: 'recording',
        mimeType: this.mimeType,
        formatLabel: describeMimeType(this.mimeType ?? ''),
        elapsedMs: 0,
        pausedSupported: this.pausedSupported,
        ...(this.snapshot.width ? {} : { width, height }),
      })
    } catch (error) {
      this.stopTimer()
      this.audio.setRecordingKeepAlive(false)
      if (this.captureStarted) environment.stopCapture()
      this.captureStarted = false
      this.combinedStream?.getTracks().forEach((track) => {
        if (track.kind !== 'audio') track.stop()
      })
      this.combinedStream = null
      this.recorder = null
      this.activeStart = null
      const message =
        error instanceof Error
          ? error.message
          : 'The recording could not be started. Check codec support and try again.'
      this.emit({
        phase: 'error',
        error: message,
        notice: null,
        elapsedMs: 0,
      })
    }
  }

  private pausedSupported = true

  private attachRecorderHandlers(recorder: MediaRecorder, settings: RecordingSettings): void {
    recorder.addEventListener('dataavailable', (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data)
        const bytes = this.chunks.reduce((sum, chunk) => sum + chunk.size, 0)
        this.emit({ bytes })
      }
    })
    recorder.addEventListener('error', (event: Event) => {
      const error = (event as ErrorEvent).error
      this.handleRecorderError(error instanceof Error ? error.message : 'The media encoder failed.')
    })
    recorder.addEventListener('stop', () => {
      void this.finalize(settings)
    })
  }

  private clearRecorderHandlers(recorder: MediaRecorder | null): void {
    if (!recorder) return
    // MediaRecorder does not expose handler references for removal. Assigning
    // listeners with bound closures above means abandoned attempts are short-
    // lived and are never started, so this is a no-op placeholder for clarity.
    void recorder
  }

  pause(): void {
    if (!this.recorder || this.snapshot.phase !== 'recording') return
    if (typeof this.recorder.pause !== 'function') {
      this.emit({ notice: 'Pausing is not supported by this browser. Stop when you are ready.' })
      return
    }
    try {
      this.recorder.pause()
      this.accumulatedMs = this.elapsed()
      this.activeStart = null
      this.emit({ phase: 'paused', elapsedMs: this.accumulatedMs, notice: null })
    } catch {
      this.emit({ notice: 'The browser could not pause this recording.' })
    }
  }

  resume(): void {
    if (!this.recorder || this.snapshot.phase !== 'paused') return
    try {
      this.recorder.resume()
      this.activeStart = performance.now()
      this.emit({ phase: 'recording', notice: null })
    } catch {
      this.emit({ notice: 'The browser could not resume this recording.' })
    }
  }

  stop(): void {
    if (!this.recorder) return
    if (this.stopping) return
    this.stopping = true
    if (this.snapshot.phase === 'recording') {
      this.accumulatedMs = this.elapsed()
      this.activeStart = null
    }
    this.stopTimer()
    this.emit({ phase: 'processing', elapsedMs: this.accumulatedMs })
    const recorder = this.recorder
    const timeout = window.setTimeout(() => {
      if (this.snapshot.phase === 'processing') {
        this.handleRecorderError('The encoder did not finish writing the recording. The browser may be low on memory.')
      }
    }, 5000)
    try {
      if (recorder.state !== 'inactive') {
        recorder.stop()
        this.finalizeGuard = timeout
      } else {
        window.clearTimeout(timeout)
        void this.finalize(this.currentSettings)
      }
    } catch {
      window.clearTimeout(timeout)
      this.handleRecorderError('The recording could not be stopped cleanly.')
    }
  }

  private async finalize(settings: RecordingSettings | null): Promise<void> {
    if (this.finalizeGuard) {
      window.clearTimeout(this.finalizeGuard)
      this.finalizeGuard = 0
    }
    this.stopTimer()
    if (this.interruptedTake || this.snapshot.phase === 'error') {
      this.releaseMedia()
      return
    }
    const mimeType = this.recorder?.mimeType || this.mimeType || 'video/webm'
    let blob = new Blob(this.chunks, { type: mimeType })
    if (blob.size === 0) {
      this.handleRecorderError('The recording finished without any video data.')
      return
    }
    const elapsedMs =
      this.activeStart !== null ? this.accumulatedMs + (performance.now() - this.activeStart) : this.accumulatedMs
    this.accumulatedMs = elapsedMs
    this.activeStart = null

    // MediaRecorder writes a streaming WebM header with no Duration element.
    // Some players then report Infinity and refuse to seek even though the file
    // is playable. Patch the EBML metadata with the measured take length.
    blob = await stampWebmDurationBlob(blob, Math.max(1, elapsedMs))
    if (this.disposed || this.getSnapshot().phase === 'error') {
      this.releaseMedia()
      return
    }

    const url = URL.createObjectURL(blob)
    const result: RecordingResult = {
      url,
      blob,
      mimeType: blob.type || mimeType,
      extension: 'webm',
      fileName: this.snapshot.fileName || (settings ? safeFileName(settings) : 'nocturne.webm'),
      durationMs: elapsedMs,
      width: this.snapshot.width,
      height: this.snapshot.height,
      hasAudio: settings?.includeAudio ?? this.snapshot.hasAudio,
      bytes: blob.size,
    }
    this.emit({
      phase: 'ready',
      bytes: blob.size,
      mimeType,
      formatLabel: describeMimeType(mimeType),
      elapsedMs,
      result,
      error: null,
      notice: null,
      fileName: result.fileName,
    })
    this.releaseMedia()
  }

  private handleRecorderError(message: string): void {
    this.stopTimer()
    this.activeStart = null
    this.chunks = []
    this.emit({
      phase: 'error',
      error: message,
      notice: null,
      result: null,
      bytes: 0,
    })
    try {
      if (this.recorder && this.recorder.state !== 'inactive') {
        this.recorder.stop()
      }
    } catch {
      // The recorder may already be torn down.
    }
    this.releaseMedia(true)
  }

  private releaseMedia(stopCapture = true): void {
    if (this.finalizeGuard) {
      window.clearTimeout(this.finalizeGuard)
      this.finalizeGuard = 0
    }
    this.stopTimer()
    const environment = this.getEnvironment()
    if (this.captureStarted && stopCapture) {
      environment?.stopCapture()
    }
    this.captureStarted = false
    this.combinedStream?.getVideoTracks().forEach((track) => track.stop())
    this.combinedStream = null
    this.recorder = null
    this.activeStart = null
    this.audio.setRecordingKeepAlive(false)
    this.stopping = false
  }

  private failBeforeStart(message: string): void {
    this.emit({ phase: 'error', error: message, result: null })
  }

  getSupport(includeAudio = true): RecordingSupport {
    return getRecordingSupport(includeAudio)
  }

  download(): void {
    const result = this.snapshot.result
    if (!result) return
    const anchor = document.createElement('a')
    anchor.href = result.url
    anchor.download = result.fileName
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  discardResult(): void {
    const current = this.snapshot.result
    if (current) {
      URL.revokeObjectURL(current.url)
    }
    if (this.snapshot.phase === 'ready' || this.snapshot.phase === 'error') {
      this.snapshot = snapshotIdle()
      for (const listener of this.listeners) listener()
    } else if (current) {
      this.emit({ result: null })
    }
  }

  reset(): void {
    this.discardResult()
    this.emit(snapshotIdle())
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden && this.snapshot.phase === 'recording') {
      this.pause()
      if (this.getSnapshot().phase === 'paused') {
        this.emit({
          notice: 'Recording paused automatically while the page was hidden. Resume when you return.',
        })
      }
    }
  }

  private handlePageHide = (): void => {
    const phase = this.snapshot.phase
    this.interruptedTake =
      phase === 'recording' || phase === 'paused' || phase === 'preparing' || phase === 'processing'
    this.cleanupForUnload()
  }

  private handlePageShow = (event: PageTransitionEvent): void => {
    // A page restored from the back-forward cache never unloaded its React
    // state. MediaRecorder and WebGL capture were torn down on pagehide, so
    // presenting the old "recording" state would be a lie and every control
    // would silently do nothing.
    if (!event.persisted || !this.interruptedTake) return
    this.chunks = []
    this.releaseMedia()
    this.emit({
      phase: 'error',
      error: 'The take was interrupted while the page was hidden. Nothing was saved; you can start a new take.',
      notice: null,
      result: null,
      bytes: 0,
      elapsedMs: 0,
    })
  }

  private cleanupForUnload(): void {
    this.stopTimer()
    if (this.finalizeGuard) {
      window.clearTimeout(this.finalizeGuard)
      this.finalizeGuard = 0
    }
    try {
      if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop()
    } catch {
      // Best effort on unload.
    }
    this.combinedStream?.getTracks().forEach((track) => track.stop())
    this.combinedStream = null
    if (this.captureStarted) this.getEnvironment()?.stopCapture()
    this.captureStarted = false
    this.recorder = null
    this.audio.setRecordingKeepAlive(false)
    // Do not revoke the result URL here. pagehide also fires when a page enters
    // the back-forward cache; the document, its Blob URLs and its preview stay
    // alive. URLs are released by discardResult/dispose instead.
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    window.removeEventListener('pagehide', this.handlePageHide)
    window.removeEventListener('pageshow', this.handlePageShow)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.cleanupForUnload()
    if (this.snapshot.result) URL.revokeObjectURL(this.snapshot.result.url)
    this.listeners.clear()
  }
}

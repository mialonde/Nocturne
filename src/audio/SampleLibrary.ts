import type { AmbienceSoundId } from '../config/ambience'
import { AMBIENCE_SAMPLES, type AmbienceSampleEntry } from '../config/ambienceSamples'

/**
 * Decoded recordings are kept in memory until roughly this many bytes are
 * used. Only the ambience library needs them, so the budget stays small
 * enough for mobile devices.
 */
const MAX_CACHED_BYTES = 48 * 1024 * 1024

interface CacheEntry {
  buffer: AudioBuffer
  bytes: number
  usedAt: number
}

/**
 * Loads recorded ambience files and decodes them into `AudioBuffer`s.
 *
 * The library never throws: a missing or undecodable file resolves to `null`
 * so the caller can keep the procedural layer running.
 */
export class SampleLibrary {
  private readonly context: AudioContext
  private readonly cache = new Map<AmbienceSoundId, CacheEntry>()
  private readonly pending = new Map<AmbienceSoundId, Promise<AudioBuffer | null>>()
  private readonly failed = new Set<AmbienceSoundId>()
  private readonly pinned = new Set<AmbienceSoundId>()
  private cachedBytes = 0
  private clock = 0

  constructor(context: AudioContext) {
    this.context = context
  }

  /** Returns the decoded buffer when it is already in memory. */
  peek(id: AmbienceSoundId): AudioBuffer | null {
    const entry = this.cache.get(id)
    if (!entry) return null
    entry.usedAt = ++this.clock
    return entry.buffer
  }

  /** True when the sound has a recording and it decoded successfully. */
  isReady(id: AmbienceSoundId): boolean {
    return this.cache.has(id)
  }

  /** True when the sound has a recording that could not be loaded. */
  hasFailed(id: AmbienceSoundId): boolean {
    return this.failed.has(id)
  }

  /**
   * Loads and decodes the recording for `id`.
   * Concurrent calls for the same sound share one request.
   */
  async load(id: AmbienceSoundId): Promise<AudioBuffer | null> {
    const cached = this.peek(id)
    if (cached) return cached
    if (this.failed.has(id)) return null
    const inflight = this.pending.get(id)
    if (inflight) return inflight

    const promise = this.fetchAndDecode(id).finally(() => {
      this.pending.delete(id)
    })
    this.pending.set(id, promise)
    return promise
  }

  /** Keeps a recording in memory while its track is playing. */
  pin(id: AmbienceSoundId, pinned: boolean): void {
    if (pinned) {
      this.pinned.add(id)
      return
    }
    this.pinned.delete(id)
  }

  dispose(): void {
    this.cache.clear()
    this.pending.clear()
    this.failed.clear()
    this.pinned.clear()
    this.cachedBytes = 0
  }

  private async fetchAndDecode(id: AmbienceSoundId): Promise<AudioBuffer | null> {
    const entry = AMBIENCE_SAMPLES[id]
    if (!entry) return null

    const candidates = this.pickUrls(entry)
    if (candidates.length === 0) {
      this.failed.add(id)
      return null
    }

    for (const url of candidates) {
      try {
        const response = await fetch(url, { cache: 'force-cache' })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const payload = await response.arrayBuffer()
        const buffer = await this.context.decodeAudioData(payload)
        this.store(id, buffer)
        return buffer
      } catch (error) {
        console.warn(
          `[nocturne] ambience recording "${id}" could not be loaded from ${url}; trying the next format.`,
          error,
        )
      }
    }

    this.failed.add(id)
    return null
  }

  /**
   * Lists the readable variants of a recording, best format first. The
   * browser decides what it can decode; the second entry is the safety net.
   */
  private pickUrls(entry: AmbienceSampleEntry): string[] {
    const urls: string[] = []
    if (entry.ogg && this.canPlayType('audio/ogg; codecs="vorbis"')) urls.push(entry.ogg)
    if (entry.mp3 && this.canPlayType('audio/mpeg')) urls.push(entry.mp3)
    if (urls.length === 0) {
      if (entry.ogg) urls.push(entry.ogg)
      if (entry.mp3) urls.push(entry.mp3)
    }
    return urls
  }

  private canPlayType(mime: string): boolean {
    if (typeof document === 'undefined') return false
    const probe = document.createElement('audio')
    const result = probe.canPlayType(mime)
    return result === 'probably' || result === 'maybe'
  }

  private store(id: AmbienceSoundId, buffer: AudioBuffer): void {
    const bytes = buffer.length * buffer.numberOfChannels * 4
    this.evict(bytes)
    this.cache.set(id, { buffer, bytes, usedAt: ++this.clock })
    this.cachedBytes += bytes
  }

  /** Drops the least recently used recordings until the new one fits. */
  private evict(incomingBytes: number): void {
    if (this.cachedBytes + incomingBytes <= MAX_CACHED_BYTES) return
    const candidates = [...this.cache.entries()]
      .filter(([id]) => !this.pinned.has(id))
      .sort((a, b) => a[1].usedAt - b[1].usedAt)

    for (const [id, entry] of candidates) {
      this.cache.delete(id)
      this.cachedBytes -= entry.bytes
      if (this.cachedBytes + incomingBytes <= MAX_CACHED_BYTES) break
    }
  }
}

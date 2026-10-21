import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '../audio/AudioEngine'
import { AudioExporter } from './AudioExporter'

class FakeRecorder extends EventTarget {
  static instances: FakeRecorder[] = []
  static isTypeSupported = () => true
  state = 'inactive'
  mimeType: string
  constructor(_stream: unknown, options: { mimeType: string }) {
    super()
    this.mimeType = options.mimeType
    FakeRecorder.instances.push(this)
  }
  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    queueMicrotask(() => {
      const event = new Event('dataavailable')
      Object.assign(event, { data: new Blob(['encoded audio']) })
      this.dispatchEvent(event)
      this.dispatchEvent(new Event('stop'))
    })
  }
}

const buffer = {
  numberOfChannels: 2, length: 2, sampleRate: 44100, duration: 1,
  getChannelData: () => new Float32Array([0.1, -0.1]),
  copyFromChannel: () => {}, copyToChannel: () => {},
} as AudioBuffer

function setup(decode = vi.fn().mockResolvedValue(buffer)) {
  const audio = {
    getMediaStream: () => ({ getAudioTracks: () => [{}] }),
    getContext: () => ({ decodeAudioData: decode }),
  } as unknown as AudioEngine
  return { exporter: new AudioExporter(audio), decode }
}
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  FakeRecorder.instances = []
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('audio export lifecycle', () => {
  it('blocks a new take while decoding and produces a WAV result', async () => {
    let finish!: (value: AudioBuffer) => void
    const decode = vi.fn(() => new Promise<AudioBuffer>((resolve) => { finish = resolve }))
    const { exporter } = setup(decode)
    await exporter.start()
    await exporter.stop()
    await flush()
    expect(exporter.getSnapshot().phase).toBe('processing')
    await exporter.start()
    expect(FakeRecorder.instances).toHaveLength(1)
    finish(buffer)
    await flush()
    expect(exporter.getSnapshot().result?.blob.type).toBe('audio/wav')
    exporter.dispose()
  })

  it('stops a discarded recorder and ignores its late events', async () => {
    const { exporter, decode } = setup()
    await exporter.start()
    exporter.discard()
    await exporter.start()
    await flush()
    expect(FakeRecorder.instances[0].state).toBe('inactive')
    expect(exporter.getSnapshot().phase).toBe('recording')
    expect(decode).not.toHaveBeenCalled()
    exporter.dispose()
  })

  it.each(['discard', 'dispose'] as const)('does not publish an in-flight decode after %s', async (action) => {
    let finish!: (value: AudioBuffer) => void
    const { exporter } = setup(vi.fn(() => new Promise<AudioBuffer>((resolve) => { finish = resolve })))
    await exporter.start()
    await exporter.stop()
    await flush()
    exporter[action]()
    finish(buffer)
    await flush()
    expect(exporter.getSnapshot().phase).toBe('idle')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    exporter.dispose()
  })

  it('releases a previous result when starting another take', async () => {
    const { exporter } = setup()
    await exporter.start()
    await exporter.stop()
    await flush()
    expect(exporter.getSnapshot().phase).toBe('ready')
    await exporter.start()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
    exporter.dispose()
  })

  it('cleans up and reports recorder errors', async () => {
    const { exporter } = setup()
    await exporter.start()
    FakeRecorder.instances[0].dispatchEvent(new Event('error'))
    await flush()
    expect(exporter.getSnapshot().phase).toBe('error')
    expect(FakeRecorder.instances[0].state).toBe('inactive')
    exporter.dispose()
  })
})

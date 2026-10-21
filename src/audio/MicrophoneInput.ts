/**
 * Optional local-only microphone analysis. The stream is connected exclusively
 * to an AnalyserNode, never to the destination or the recording bus.
 */
export class MicrophoneInput {
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private disposableContext: AudioContext | null = null

  async start(context?: AudioContext): Promise<AnalyserNode> {
    if (!window.isSecureContext) {
      throw new Error('Microphone access requires HTTPS or localhost.')
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not expose microphone capture.')
    }
    if (this.analyser) return this.analyser

    const ownsContext = !context
    const ctx = context ?? new AudioContext({ latencyHint: 'interactive' })
    if (ownsContext) this.disposableContext = ctx

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
        video: false,
      })
    } catch (error) {
      if (ownsContext) {
        await ctx.close().catch(() => undefined)
        this.disposableContext = null
      }
      throw normalizeMicrophoneError(error)
    }

    this.stream = stream
    this.source = ctx.createMediaStreamSource(stream)
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.smoothingTimeConstant = 0.82
    this.analyser.minDecibels = -92
    this.analyser.maxDecibels = -12
    // Deliberately no connection to the audio destination.
    this.source.connect(this.analyser)
    return this.analyser
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.source?.disconnect()
    this.analyser?.disconnect()
    this.stream = null
    this.source = null
    this.analyser = null
    if (this.disposableContext) {
      void this.disposableContext.close().catch(() => undefined)
      this.disposableContext = null
    }
  }
}

export function normalizeMicrophoneError(error: unknown): Error {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return new Error('Microphone permission was not granted. The environment continues without it.')
    }
    if (error.name === 'NotFoundError') {
      return new Error('No microphone was found on this device.')
    }
    if (error.name === 'NotReadableError') {
      return new Error('The microphone is currently in use by another application.')
    }
    return new Error(error.message || 'The microphone could not be opened.')
  }
  return new Error(error instanceof Error ? error.message : 'The microphone could not be opened.')
}

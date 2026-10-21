import { computeBinauralPair, TONE_CEILING } from '../config/audio'
import type { AudioSettings, FrequencyPair } from '../types'
import { clamp, safeRamp } from './audioUtils'

type BinauralConfig = Pick<
  AudioSettings,
  'carrier' | 'beat' | 'binauralVolume' | 'binauralEnabled' | 'modulation'
>

/**
 * A genuine two-oscillator binaural generator.
 *
 * The important part of this graph is the ChannelMergerNode: the left
 * oscillator enters channel 0 and the right oscillator enters channel 1.
 * There is deliberately no panner, no mono summing and no shared oscillator
 * after the merger. Downstream nodes preserve two channels all the way to the
 * MediaStreamAudioDestinationNode.
 */
export class BinauralAudioEngine {
  private readonly context: AudioContext
  private readonly oscillatorLeft: OscillatorNode
  private readonly oscillatorRight: OscillatorNode
  private readonly leftGain: GainNode
  private readonly rightGain: GainNode
  private readonly merger: ChannelMergerNode
  private readonly enableGain: GainNode
  private readonly modulationLeft: OscillatorNode
  private readonly modulationRight: OscillatorNode
  private readonly modulationLeftDepth: GainNode
  private readonly modulationRightDepth: GainNode
  private readonly config: BinauralConfig
  private disposed = false

  constructor(context: AudioContext, destination: AudioNode, initial: BinauralConfig) {
    this.context = context
    this.config = { ...initial }

    // A ChannelMergerNode's channelCount is fixed at 1 and its channelCountMode
    // is fixed at 'explicit'; assigning either throws in Chromium and would
    // abort the whole audio graph. The node's *output* is already the number
    // of inputs (2), which is what matters for the hard-panned pair.
    this.merger = context.createChannelMerger(2)

    this.enableGain = context.createGain()
    this.enableGain.gain.value = 0
    this.enableGain.channelCount = 2
    this.enableGain.channelCountMode = 'explicit'
    this.enableGain.channelInterpretation = 'speakers'

    this.leftGain = context.createGain()
    this.rightGain = context.createGain()
    this.leftGain.channelCount = 1
    this.rightGain.channelCount = 1

    this.oscillatorLeft = context.createOscillator()
    this.oscillatorRight = context.createOscillator()
    this.oscillatorLeft.type = 'sine'
    this.oscillatorRight.type = 'sine'

    const pair = computeBinauralPair(initial.carrier, initial.beat)
    this.oscillatorLeft.frequency.value = pair.left
    this.oscillatorRight.frequency.value = pair.right

    // The two independent tones only meet inside the two input lanes of the
    // merger. Each lane is explicitly mono before that point.
    this.oscillatorLeft.connect(this.leftGain)
    this.oscillatorRight.connect(this.rightGain)
    this.leftGain.connect(this.merger, 0, 0)
    this.rightGain.connect(this.merger, 0, 1)
    this.merger.connect(this.enableGain)
    this.enableGain.connect(destination)

    const amplitude = this.amplitudeFor(initial.binauralVolume)
    this.leftGain.gain.value = amplitude
    this.rightGain.gain.value = amplitude

    // Slow, unsynchronised amplitude motion. Both tones remain hard-panned;
    // this only adds a barely perceptible width movement when enabled.
    this.modulationLeft = context.createOscillator()
    this.modulationRight = context.createOscillator()
    this.modulationLeft.type = 'sine'
    this.modulationRight.type = 'sine'
    this.modulationLeft.frequency.value = 0.061
    this.modulationRight.frequency.value = 0.073
    this.modulationLeftDepth = context.createGain()
    this.modulationRightDepth = context.createGain()
    this.modulationLeftDepth.gain.value = initial.modulation ? amplitude * 0.065 : 0
    this.modulationRightDepth.gain.value = initial.modulation ? amplitude * 0.052 : 0
    this.modulationLeft.connect(this.modulationLeftDepth)
    this.modulationRight.connect(this.modulationRightDepth)
    this.modulationLeftDepth.connect(this.leftGain.gain)
    this.modulationRightDepth.connect(this.rightGain.gain)

    const now = context.currentTime
    this.oscillatorLeft.start(now)
    this.oscillatorRight.start(now)
    this.modulationLeft.start(now)
    this.modulationRight.start(now)

    if (initial.binauralEnabled) {
      this.enableGain.gain.setValueAtTime(0, now)
      this.enableGain.gain.linearRampToValueAtTime(1, now + 1.8)
    } else {
      this.enableGain.gain.setValueAtTime(0, now)
    }
  }

  private amplitudeFor(volume: number): number {
    const safeVolume = clamp(volume, 0, 1)
    return TONE_CEILING * Math.pow(safeVolume, 1.15)
  }

  update(config: Partial<BinauralConfig>, rampSeconds = 0.12): void {
    if (this.disposed) return
    const now = this.context.currentTime
    const next = { ...this.config, ...config }

    if (next.carrier !== this.config.carrier || next.beat !== this.config.beat) {
      this.setFrequency(next.carrier, next.beat, rampSeconds)
    }

    if (next.binauralVolume !== this.config.binauralVolume) {
      const amplitude = this.amplitudeFor(next.binauralVolume)
      const volumeRamp = Math.min(0.35, Math.max(0.04, rampSeconds))
      safeRamp(this.leftGain.gain, amplitude, now, volumeRamp)
      safeRamp(this.rightGain.gain, amplitude, now, volumeRamp)
      const depthLeft = next.modulation ? amplitude * 0.065 : 0
      const depthRight = next.modulation ? amplitude * 0.052 : 0
      safeRamp(this.modulationLeftDepth.gain, depthLeft, now, volumeRamp)
      safeRamp(this.modulationRightDepth.gain, depthRight, now, volumeRamp)
    }

    if (next.modulation !== this.config.modulation) {
      const amplitude = this.amplitudeFor(next.binauralVolume)
      safeRamp(
        this.modulationLeftDepth.gain,
        next.modulation ? amplitude * 0.065 : 0,
        now,
        0.5,
      )
      safeRamp(
        this.modulationRightDepth.gain,
        next.modulation ? amplitude * 0.052 : 0,
        now,
        0.5,
      )
    }

    if (next.binauralEnabled !== this.config.binauralEnabled) {
      const target = next.binauralEnabled ? 1 : 0
      const fadeTime = Math.max(0.2, Math.min(2.0, rampSeconds))
      safeRamp(this.enableGain.gain, target, now, fadeTime)
    }

    this.config.carrier = next.carrier
    this.config.beat = next.beat
    this.config.binauralVolume = next.binauralVolume
    this.config.binauralEnabled = next.binauralEnabled
    this.config.modulation = next.modulation
  }

  setFrequency(carrier: number, beat: number, rampSeconds = 0.12): void {
    if (this.disposed) return
    const pair = computeBinauralPair(carrier, beat)
    const now = this.context.currentTime
    // Frequency uses a linear ramp so it lands exactly on the requested
    // values rather than asymptotically approaching them.
    safeRamp(this.oscillatorLeft.frequency, pair.left, now, rampSeconds)
    safeRamp(this.oscillatorRight.frequency, pair.right, now, rampSeconds)
    this.config.carrier = carrier
    this.config.beat = beat
  }

  /**
   * Slides the pair from one beat difference to another across a passage.
   *
   * The ramp lives in the audio thread, so a long slide costs nothing in the
   * interface and keeps its shape even when the page is busy.
   */
  setLadder(
    from: { carrier: number; beat: number },
    to: { carrier: number; beat: number },
    seconds: number,
  ): void {
    if (this.disposed) return
    const now = this.context.currentTime
    const duration = Math.max(0.5, Math.min(3600, seconds))
    const start = computeBinauralPair(from.carrier, from.beat)
    const end = computeBinauralPair(to.carrier, to.beat)

    this.oscillatorLeft.frequency.cancelScheduledValues(now)
    this.oscillatorRight.frequency.cancelScheduledValues(now)
    this.oscillatorLeft.frequency.setValueAtTime(start.left, now)
    this.oscillatorRight.frequency.setValueAtTime(start.right, now)
    this.oscillatorLeft.frequency.linearRampToValueAtTime(end.left, now + duration)
    this.oscillatorRight.frequency.linearRampToValueAtTime(end.right, now + duration)

    this.config.carrier = from.carrier
    this.config.beat = from.beat
  }

  getFrequencyPair(): FrequencyPair {
    return {
      left: this.oscillatorLeft.frequency.value,
      right: this.oscillatorRight.frequency.value,
      beat: Math.abs(this.oscillatorLeft.frequency.value - this.oscillatorRight.frequency.value),
    }
  }

  getConfig(): BinauralConfig {
    return { ...this.config }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    try {
      this.oscillatorLeft.stop()
      this.oscillatorRight.stop()
      this.modulationLeft.stop()
      this.modulationRight.stop()
    } catch {
      // Oscillators can only be stopped once.
    }
    this.oscillatorLeft.disconnect()
    this.oscillatorRight.disconnect()
    this.modulationLeft.disconnect()
    this.modulationRight.disconnect()
    this.leftGain.disconnect()
    this.rightGain.disconnect()
    this.modulationLeftDepth.disconnect()
    this.modulationRightDepth.disconnect()
    this.merger.disconnect()
    this.enableGain.disconnect()
  }
}

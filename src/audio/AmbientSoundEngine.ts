import { AMBIENT_WEIGHTS } from '../config/audio'
import { THEMES } from '../config/themes'
import type { AudioSettings, ThemeId } from '../types'
import { clamp, createImpulseResponse, createNoiseBuffer, safeSetTarget } from './audioUtils'

const LAYER_BASE = {
  drone: 0.205,
  harmony: 0.115,
  wind: 0.082,
  resonance: 0.12,
} as const

type AmbientConfig = Pick<
  AudioSettings,
  'ambientEnabled' | 'ambientMuted' | 'ambientMaster' | 'layers' | 'reverbEnabled'
>

/**
 * A fully procedural ambient bed. Nothing is sampled: drone oscillators,
 * harmonically related partials, filtered stereo noise and sparse resonant
 * tones are generated live. Every parameter moves through ramped gain nodes.
 */
export class AmbientSoundEngine {
  private readonly context: AudioContext
  private readonly outputGain: GainNode
  private readonly highpass: BiquadFilterNode
  private readonly layerBus: GainNode
  private readonly droneGain: GainNode
  private readonly harmonyGain: GainNode
  private readonly windGain: GainNode
  private readonly resonanceGain: GainNode
  private readonly droneFilter: BiquadFilterNode
  private readonly harmonyFilter: BiquadFilterNode
  private readonly windBand: BiquadFilterNode
  private readonly windLowpass: BiquadFilterNode
  private readonly droneOscillators: OscillatorNode[] = []
  private readonly droneOscillatorGains: GainNode[] = []
  private readonly harmonyOscillators: OscillatorNode[] = []
  private readonly harmonyOscillatorGains: GainNode[] = []
  private readonly harmonyPanners: StereoPannerNode[] = []
  private readonly lfos: OscillatorNode[] = []
  private readonly reverbSend: GainNode
  private readonly convolver: ConvolverNode
  private readonly reverbWet: GainNode
  private readonly delaySend: GainNode
  private readonly delay: DelayNode
  private readonly delayFeedback: GainNode
  private readonly delayFilter: BiquadFilterNode
  private readonly delayWet: GainNode
  private readonly windSource: AudioBufferSourceNode
  private readonly droneLfoDepth: GainNode
  private readonly droneLfo: OscillatorNode
  private readonly windLfoDepth: GainNode
  private readonly windLfo: OscillatorNode

  private config: AmbientConfig
  private themeId: ThemeId
  private profileId: ThemeId
  private disposed = false
  private pingTimer: number | null = null
  private pingCount = 0

  constructor(
    context: AudioContext,
    destination: AudioNode,
    config: AmbientConfig,
    themeId: ThemeId,
    profileId: ThemeId,
  ) {
    this.context = context
    this.config = {
      ...config,
      layers: { ...config.layers },
    }
    this.themeId = themeId
    this.profileId = profileId

    this.outputGain = context.createGain()
    this.outputGain.gain.value = 0
    this.highpass = context.createBiquadFilter()
    this.highpass.type = 'highpass'
    this.highpass.frequency.value = 26
    this.highpass.Q.value = 0.4
    this.layerBus = context.createGain()
    this.layerBus.gain.value = 1

    this.layerBus.connect(this.outputGain)
    this.outputGain.connect(this.highpass)
    this.highpass.connect(destination)

    this.droneGain = context.createGain()
    this.harmonyGain = context.createGain()
    this.windGain = context.createGain()
    this.resonanceGain = context.createGain()
    this.droneGain.gain.value = 0
    this.harmonyGain.gain.value = 0
    this.windGain.gain.value = 0
    this.resonanceGain.gain.value = 0
    this.droneGain.connect(this.layerBus)
    this.harmonyGain.connect(this.layerBus)
    this.windGain.connect(this.layerBus)
    this.resonanceGain.connect(this.layerBus)

    // Drone: three low voices, gently filtered to keep low energy controlled.
    this.droneFilter = context.createBiquadFilter()
    this.droneFilter.type = 'lowpass'
    this.droneFilter.frequency.value = 200
    this.droneFilter.Q.value = 0.45
    this.droneFilter.connect(this.droneGain)

    const droneRatios = [1, 1.498, 2.003]
    droneRatios.forEach((ratio, index) => {
      const oscillator = context.createOscillator()
      oscillator.type = index === 2 ? 'triangle' : 'sine'
      oscillator.frequency.value = THEMES[themeId].atmosphere.droneRoot * ratio
      oscillator.detune.value = (index - 1) * 3.2
      const gain = context.createGain()
      gain.gain.value = index === 2 ? 0.1 : 0.17
      oscillator.connect(gain)
      gain.connect(this.droneFilter)
      oscillator.start()
      this.droneOscillators.push(oscillator)
      this.droneOscillatorGains.push(gain)
    })

    this.droneLfo = context.createOscillator()
    this.droneLfo.frequency.value = 0.018
    this.droneLfoDepth = context.createGain()
    this.droneLfoDepth.gain.value = 30
    this.droneLfo.connect(this.droneLfoDepth)
    this.droneLfoDepth.connect(this.droneFilter.frequency)
    this.droneLfo.start()
    this.lfos.push(this.droneLfo)

    // Harmony: a quiet, slowly beating chord suspended above the drone.
    this.harmonyFilter = context.createBiquadFilter()
    this.harmonyFilter.type = 'lowpass'
    this.harmonyFilter.frequency.value = 1400
    this.harmonyFilter.Q.value = 0.35
    this.harmonyFilter.connect(this.harmonyGain)

    const harmonyRatios = [1, 1.5, 2.25]
    const harmonyPan = [-0.42, 0.15, 0.48]
    harmonyRatios.forEach((ratio, index) => {
      const oscillator = context.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = THEMES[themeId].atmosphere.harmonicRoot * ratio
      const gain = context.createGain()
      gain.gain.value = 0.12 - index * 0.018
      const panner = context.createStereoPanner()
      panner.pan.value = harmonyPan[index] ?? 0
      oscillator.connect(gain)
      gain.connect(panner)
      panner.connect(this.harmonyFilter)
      oscillator.start()
      this.harmonyOscillators.push(oscillator)
      this.harmonyOscillatorGains.push(gain)
      this.harmonyPanners.push(panner)
    })

    // Filtered, decorrelated noise gives the bed a distant airy movement.
    const noiseBuffer = createNoiseBuffer(context, 4)
    this.windSource = context.createBufferSource()
    this.windSource.buffer = noiseBuffer
    this.windSource.loop = true
    this.windBand = context.createBiquadFilter()
    this.windBand.type = 'bandpass'
    this.windBand.frequency.value = THEMES[themeId].atmosphere.windCutoff
    this.windBand.Q.value = 0.55
    this.windLowpass = context.createBiquadFilter()
    this.windLowpass.type = 'lowpass'
    this.windLowpass.frequency.value = 1900
    this.windLowpass.Q.value = 0.2
    this.windSource.connect(this.windBand)
    this.windBand.connect(this.windLowpass)
    this.windLowpass.connect(this.windGain)
    this.windSource.start()

    this.windLfo = context.createOscillator()
    this.windLfo.frequency.value = 0.024
    this.windLfoDepth = context.createGain()
    this.windLfoDepth.gain.value = 130
    this.windLfo.connect(this.windLfoDepth)
    this.windLfoDepth.connect(this.windBand.frequency)
    this.windLfo.start()
    this.lfos.push(this.windLfo)

    // A convolution reverb made from a generated impulse response.
    this.reverbSend = context.createGain()
    this.reverbSend.gain.value = 0.7
    this.convolver = context.createConvolver()
    this.convolver.normalize = true
    this.convolver.buffer = createImpulseResponse(context, 4.4, 2.9)
    this.reverbWet = context.createGain()
    this.reverbWet.gain.value = 0
    this.layerBus.connect(this.reverbSend)
    this.reverbSend.connect(this.convolver)
    this.convolver.connect(this.reverbWet)
    this.reverbWet.connect(this.outputGain)

    // A short, very quiet delay adds space without smearing the binaural cues.
    this.delaySend = context.createGain()
    this.delaySend.gain.value = 0
    this.delay = context.createDelay(3)
    this.delay.delayTime.value = 0.47
    this.delayFeedback = context.createGain()
    this.delayFeedback.gain.value = 0.24
    this.delayFilter = context.createBiquadFilter()
    this.delayFilter.type = 'lowpass'
    this.delayFilter.frequency.value = 1700
    this.delayWet = context.createGain()
    this.delayWet.gain.value = 0
    this.layerBus.connect(this.delaySend)
    this.delaySend.connect(this.delay)
    this.delay.connect(this.delayFilter)
    this.delayFilter.connect(this.delayFeedback)
    this.delayFeedback.connect(this.delay)
    this.delayFilter.connect(this.delayWet)
    this.delayWet.connect(this.outputGain)

    this.applyMix(2)
    this.scheduleNextPing(6000 + Math.random() * 5000)
  }

  setTheme(themeId: ThemeId, rampSeconds = 2.2): void {
    if (this.disposed) return
    const theme = THEMES[themeId]
    this.themeId = themeId
    const now = this.context.currentTime
    const droneRatios = [1, 1.498, 2.003]
    this.droneOscillators.forEach((oscillator, index) => {
      safeSetTarget(
        oscillator.frequency,
        theme.atmosphere.droneRoot * (droneRatios[index] ?? 1),
        now,
        rampSeconds,
      )
      oscillator.detune.value = (index - 1) * theme.atmosphere.detuneCents
    })
    safeSetTarget(this.droneFilter.frequency, theme.atmosphere.droneFilter, now, rampSeconds)
    const harmonyRatios = [1, 1.5, 2.25]
    this.harmonyOscillators.forEach((oscillator, index) => {
      safeSetTarget(
        oscillator.frequency,
        theme.atmosphere.harmonicRoot * (harmonyRatios[index] ?? 1),
        now,
        rampSeconds,
      )
    })
    safeSetTarget(this.windBand.frequency, theme.atmosphere.windCutoff, now, rampSeconds)
    safeSetTarget(this.windLowpass.frequency, theme.atmosphere.windCutoff * 2.6, now, rampSeconds)
    safeSetTarget(this.harmonyFilter.frequency, 1000 + theme.atmosphere.windCutoff * 0.7, now, rampSeconds)
    safeSetTarget(this.delay.delayTime, 0.36 + theme.atmosphere.delayMix * 0.7, now, 1.5)
    this.applyMix(rampSeconds)
  }

  setProfile(profileId: ThemeId, rampSeconds = 2): void {
    if (this.disposed) return
    this.profileId = profileId
    this.applyMix(rampSeconds)
  }

  update(config: Partial<AmbientConfig>, rampSeconds = 0.3): void {
    if (this.disposed) return
    this.config = {
      ...this.config,
      ...config,
      layers: { ...this.config.layers, ...(config.layers ?? {}) },
    }
    this.applyMix(rampSeconds)
  }

  private applyMix(rampSeconds: number): void {
    if (this.disposed) return
    const now = this.context.currentTime
    const weights = AMBIENT_WEIGHTS[this.profileId]
    const theme = THEMES[this.themeId]
    const user = this.config
    const layer = user.layers

    const target = (base: number, weight: number, value: number) =>
      Math.max(0, base * weight * clamp(value, 0, 1))

    safeSetTarget(
      this.droneGain.gain,
      target(LAYER_BASE.drone, weights.drone, layer.drone),
      now,
      rampSeconds,
    )
    safeSetTarget(
      this.harmonyGain.gain,
      target(LAYER_BASE.harmony, weights.harmony, layer.harmony),
      now,
      rampSeconds,
    )
    safeSetTarget(
      this.windGain.gain,
      target(LAYER_BASE.wind, weights.wind, layer.wind),
      now,
      rampSeconds,
    )
    safeSetTarget(
      this.resonanceGain.gain,
      target(LAYER_BASE.resonance, weights.resonance, layer.resonance),
      now,
      rampSeconds,
    )

    const output =
      user.ambientEnabled && !user.ambientMuted ? clamp(user.ambientMaster, 0, 1) * 0.92 : 0
    safeSetTarget(this.outputGain.gain, output, now, rampSeconds)

    const wet = user.reverbEnabled ? 0.54 * weights.reverb * theme.atmosphere.reverbWet : 0
    safeSetTarget(this.reverbWet.gain, wet, now, rampSeconds)
    safeSetTarget(
      this.delaySend.gain,
      user.reverbEnabled ? 0.14 * theme.atmosphere.delayMix : 0,
      now,
      rampSeconds,
    )
    safeSetTarget(
      this.delayWet.gain,
      user.reverbEnabled ? 0.12 * theme.atmosphere.delayMix : 0,
      now,
      rampSeconds,
    )
  }

  private scheduleNextPing(delayMs: number): void {
    if (this.disposed) return
    if (this.pingTimer !== null) window.clearTimeout(this.pingTimer)
    this.pingTimer = window.setTimeout(() => {
      this.pingTimer = null
      if (this.disposed) return
      if (
        this.context.state === 'running' &&
        this.config.ambientEnabled &&
        !this.config.ambientMuted
      ) {
        this.playPing()
      }
      this.scheduleNextPing(9000 + Math.random() * 13000)
    }, Math.max(1000, delayMs))
  }

  private playPing(): void {
    if (this.disposed) return
    this.pingCount += 1
    const now = this.context.currentTime
    const theme = THEMES[this.themeId]
    const ratios = [3.01, 4.49, 5.02, 6.72]
    const ratio = ratios[this.pingCount % ratios.length] ?? 3
    const frequency = theme.atmosphere.harmonicRoot * ratio
    const pan = Math.random() * 1.2 - 0.6
    const duration = 6.5 + Math.random() * 2.5

    const oscillator = this.context.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    oscillator.detune.value = Math.random() * 8 - 4

    const partial = this.context.createOscillator()
    partial.type = 'sine'
    partial.frequency.value = frequency * 2.003

    const gain = this.context.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.075, now + 1.6)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    const partialGain = this.context.createGain()
    partialGain.gain.setValueAtTime(0.0001, now)
    partialGain.gain.exponentialRampToValueAtTime(0.018, now + 2.1)
    partialGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.8)

    const panner = this.context.createStereoPanner()
    panner.pan.value = pan

    oscillator.connect(gain)
    partial.connect(partialGain)
    gain.connect(panner)
    partialGain.connect(panner)
    panner.connect(this.resonanceGain)

    oscillator.start(now)
    partial.start(now)
    oscillator.stop(now + duration + 0.2)
    partial.stop(now + duration + 0.2)

    const cleanup = () => {
      oscillator.disconnect()
      partial.disconnect()
      gain.disconnect()
      partialGain.disconnect()
      panner.disconnect()
    }
    oscillator.addEventListener('ended', cleanup, { once: true })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.pingTimer !== null) {
      window.clearTimeout(this.pingTimer)
      this.pingTimer = null
    }
    try {
      this.windSource.stop()
      this.droneOscillators.forEach((oscillator) => oscillator.stop())
      this.harmonyOscillators.forEach((oscillator) => oscillator.stop())
      this.lfos.forEach((oscillator) => oscillator.stop())
    } catch {
      // Some browsers throw if a source has already ended.
    }
    this.windSource.disconnect()
    this.droneOscillators.forEach((oscillator) => oscillator.disconnect())
    this.harmonyOscillators.forEach((oscillator) => oscillator.disconnect())
    this.droneOscillatorGains.forEach((gain) => gain.disconnect())
    this.harmonyOscillatorGains.forEach((gain) => gain.disconnect())
    this.harmonyPanners.forEach((panner) => panner.disconnect())
    this.lfos.forEach((oscillator) => oscillator.disconnect())
    this.droneLfoDepth.disconnect()
    this.windLfoDepth.disconnect()
    this.droneFilter.disconnect()
    this.harmonyFilter.disconnect()
    this.windBand.disconnect()
    this.windLowpass.disconnect()
    this.droneGain.disconnect()
    this.harmonyGain.disconnect()
    this.windGain.disconnect()
    this.resonanceGain.disconnect()
    this.layerBus.disconnect()
    this.reverbSend.disconnect()
    this.convolver.disconnect()
    this.reverbWet.disconnect()
    this.delaySend.disconnect()
    this.delay.disconnect()
    this.delayFeedback.disconnect()
    this.delayFilter.disconnect()
    this.delayWet.disconnect()
    this.outputGain.disconnect()
    this.highpass.disconnect()
  }
}

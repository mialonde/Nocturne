import type { AudioAnalysis, AudioSettings, SoundscapeProfileId, ThemeId } from '../types'
import type { AmbienceSoundId } from '../config/ambience'
import { isThemeId } from '../config/themes'
import { AmbienceLibraryEngine } from './AmbienceLibraryEngine'
import { AmbientSoundEngine } from './AmbientSoundEngine'
import { BinauralAudioEngine } from './BinauralAudioEngine'
import { MicrophoneInput } from './MicrophoneInput'
import { clamp, safeRamp, safeSetTarget } from './audioUtils'

export interface AudioDebugSnapshot {
  contextState: AudioContextState | 'uninitialized'
  initialized: boolean
  playing: boolean
  leftFrequency: number | null
  rightFrequency: number | null
  binauralEnabled: boolean
  binauralVolume: number
  ambientEnabled: boolean
  ambientMuted: boolean
  transportGain: number
  masterGain: number
  mediaDestinationChannels: number
  micActive: boolean
}

/**
 * Owns the audio graph. Binaural and ambient engines are independent branches
 * that both feed one master bus. The same master bus is recorded and monitored;
 * it is never connected to the speakers twice.
 */
export class AudioEngine {
  private context: AudioContext | null = null
  private mixBus: GainNode | null = null
  private sessionFadeGain: GainNode | null = null
  private ambientSessionGain: GainNode | null = null
  private transportGain: GainNode | null = null
  private masterGain: GainNode | null = null
  private limiter: DynamicsCompressorNode | null = null
  private sleepFadeGain: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private mediaDestination: MediaStreamAudioDestinationNode | null = null
  private binaural: BinauralAudioEngine | null = null
  private ambient: AmbientSoundEngine | null = null
  private ambienceLibrary: AmbienceLibraryEngine | null = null
  private ambienceTrackVolumes: Partial<Record<AmbienceSoundId, number>> = {}
  private readonly microphone = new MicrophoneInput()
  private channelTest:
    | {
        oscillators: OscillatorNode[]
        merger: ChannelMergerNode
        gain: GainNode
      }
    | null = null
  private channelTestTimer: number | null = null
  private audioConfig: AudioSettings
  private themeId: ThemeId
  private ambientProfile: SoundscapeProfileId
  private initialized = false
  private playing = false
  private micActive = false
  private keepAliveForRecording = false
  private suspendTimer: number | null = null
  private timeDomainData: Uint8Array<ArrayBuffer> | null = null
  private frequencyData: Uint8Array<ArrayBuffer> | null = null

  constructor(initialAudio: AudioSettings, theme: ThemeId, ambientProfile: SoundscapeProfileId) {
    this.audioConfig = {
      ...initialAudio,
      layers: { ...initialAudio.layers },
    }
    this.themeId = theme
    this.ambientProfile = ambientProfile
  }

  isInitialized(): boolean {
    return this.initialized
  }

  isPlaying(): boolean {
    return this.playing
  }

  isMicrophoneActive(): boolean {
    return this.micActive
  }

  getContext(): AudioContext | null {
    return this.context
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  getMediaStream(): MediaStream | null {
    return this.mediaDestination?.stream ?? null
  }

  getAudioTrack(): MediaStreamTrack | null {
    return this.mediaDestination?.stream.getAudioTracks()[0] ?? null
  }

  private buildGraph(context: AudioContext): void {
    const mixBus = context.createGain()
    const sessionFadeGain = context.createGain()
    const transportGain = context.createGain()
    const masterGain = context.createGain()
    const limiter = context.createDynamicsCompressor()
    const sleepFadeGain = context.createGain()
    const analyser = context.createAnalyser()
    const mediaDestination = context.createMediaStreamDestination()
    const ambientSessionGain = context.createGain()

    mixBus.gain.value = 1
    // No sound until an explicit user action ramps this open.
    transportGain.gain.value = 0
    masterGain.gain.value = this.masterGainLevel(this.audioConfig.masterVolume)
    sessionFadeGain.gain.value = 1
    sleepFadeGain.gain.value = 1
    ambientSessionGain.gain.value = 1

    limiter.threshold.value = -10
    limiter.knee.value = 18
    limiter.ratio.value = 3.5
    limiter.attack.value = 0.008
    limiter.release.value = 0.28
    limiter.channelCount = 2
    limiter.channelCountMode = 'explicit'
    limiter.channelInterpretation = 'speakers'

    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.82
    analyser.channelCount = 2
    analyser.channelCountMode = 'explicit'
    analyser.channelInterpretation = 'speakers'

    mediaDestination.channelCount = 2
    mediaDestination.channelCountMode = 'explicit'
    mediaDestination.channelInterpretation = 'speakers'

    mixBus.connect(sessionFadeGain)
    sessionFadeGain.connect(transportGain)
    transportGain.connect(masterGain)
    masterGain.connect(limiter)
    // The sleep fade is the final shared stage, so speakers and the recording
    // tap fade together without altering the user's saved master volume.
    limiter.connect(sleepFadeGain)
    sleepFadeGain.connect(context.destination)
    sleepFadeGain.connect(analyser)
    // The recording tap receives the same post-limiter stereo output. The
    // limiter node is connected once; both destinations share that signal.
    sleepFadeGain.connect(mediaDestination)

    this.mixBus = mixBus
    this.sessionFadeGain = sessionFadeGain
    this.ambientSessionGain = ambientSessionGain
    this.transportGain = transportGain
    this.masterGain = masterGain
    this.limiter = limiter
    this.sleepFadeGain = sleepFadeGain
    this.analyser = analyser
    this.mediaDestination = mediaDestination

    const themeProfile = isThemeId(this.ambientProfile) ? this.ambientProfile : this.themeId
    this.ambient = new AmbientSoundEngine(
      context,
      ambientSessionGain,
      this.audioConfig,
      this.themeId,
      themeProfile,
    )
    this.ambienceLibrary = new AmbienceLibraryEngine(context, ambientSessionGain)
    this.ambienceLibrary.setMaster(
      this.audioConfig.ambientMaster,
      this.audioConfig.ambientMuted || !this.audioConfig.ambientEnabled,
      0,
    )
    this.ambienceLibrary.setTrackVolumes(this.ambienceTrackVolumes, 0)
    ambientSessionGain.connect(mixBus)

    this.binaural = new BinauralAudioEngine(context, mixBus, {
      carrier: this.audioConfig.carrier,
      beat: this.audioConfig.beat,
      binauralVolume: this.audioConfig.binauralVolume,
      binauralEnabled: this.audioConfig.binauralEnabled,
      modulation: this.audioConfig.modulation,
    })

    this.initialized = true
  }

  private async ensureGraph(): Promise<AudioContext> {
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer)
      this.suspendTimer = null
    }
    if (!this.context) {
      const AudioContextCtor = window.AudioContext
      if (!AudioContextCtor) {
        throw new Error('This browser does not support the Web Audio API.')
      }
      this.context = new AudioContextCtor({ latencyHint: 'interactive' })
      this.buildGraph(this.context)
    }
    if (this.context.state === 'suspended') {
      await this.context.resume()
    }
    return this.context
  }

  /**
   * Must be called from an explicit user gesture. Returns after the context has
   * been resumed, before the audible fade has finished.
   */
  async start(fadeSeconds = 4): Promise<void> {
    const context = await this.ensureGraph()
    if (!this.transportGain) throw new Error('Audio graph could not be initialized.')
    this.resetSleepFade(0.08)
    const now = context.currentTime
    const gain = this.transportGain.gain
    this.playing = true
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(Math.max(0.0001, gain.value), now)
    gain.linearRampToValueAtTime(1, now + clamp(fadeSeconds, 0.2, 8))
  }

  async pause(fadeSeconds = 0.65): Promise<void> {
    if (!this.context || !this.transportGain) {
      this.playing = false
      return
    }
    const now = this.context.currentTime
    const gain = this.transportGain.gain
    this.playing = false
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(gain.value, now)
    gain.linearRampToValueAtTime(0.0001, now + clamp(fadeSeconds, 0.1, 4))
  }

  async stop(fadeSeconds = 0.8): Promise<void> {
    await this.pause(fadeSeconds)
    if (!this.context) return
    if (this.keepAliveForRecording || this.micActive) return
    if (this.suspendTimer !== null) window.clearTimeout(this.suspendTimer)
    this.suspendTimer = window.setTimeout(() => {
      this.suspendTimer = null
      if (!this.playing && !this.keepAliveForRecording && !this.micActive) {
        void this.context?.suspend().catch(() => undefined)
      }
    }, (fadeSeconds + 0.3) * 1000)
  }

  async resume(fadeSeconds = 1.2): Promise<void> {
    await this.start(fadeSeconds)
  }

  setAudioConfig(next: AudioSettings, rampSeconds = 0.18): void {
    const previous = this.audioConfig
    this.audioConfig = {
      ...next,
      layers: { ...next.layers },
    }
    if (!this.initialized || !this.context) return
    const now = this.context.currentTime

    if (this.masterGain && previous.masterVolume !== next.masterVolume) {
      // Volume controls stay responsive even while a long session transition
      // is stretching the binaural frequency ramp.
      safeRamp(
        this.masterGain.gain,
        this.masterGainLevel(next.masterVolume),
        now,
        Math.min(0.3, Math.max(0.08, rampSeconds)),
      )
    }

    this.binaural?.update(
      {
        carrier: next.carrier,
        beat: next.beat,
        binauralVolume: next.binauralVolume,
        binauralEnabled: next.binauralEnabled,
        modulation: next.modulation,
      },
      rampSeconds,
    )

    this.ambient?.update(
      {
        ambientEnabled: next.ambientEnabled,
        ambientMuted: next.ambientMuted,
        ambientMaster: next.ambientMaster,
        layers: next.layers,
        reverbEnabled: next.reverbEnabled,
      },
      Math.min(1.2, Math.max(0.2, rampSeconds)),
    )
    this.ambienceLibrary?.setMaster(
      next.ambientMaster,
      next.ambientMuted || !next.ambientEnabled,
      rampSeconds,
    )
  }

  private masterGainLevel(volume: number): number {
    return Math.pow(clamp(volume, 0, 1), 1.35) * 0.82
  }

  setTheme(theme: ThemeId, rampSeconds = 2): void {
    this.themeId = theme
    this.ambient?.setTheme(theme, rampSeconds)
  }

  setAmbientProfile(profile: SoundscapeProfileId, rampSeconds = 1.6): void {
    this.ambientProfile = profile
    if (isThemeId(profile)) {
      this.ambient?.setProfile(profile, rampSeconds)
    }
  }

  setAmbienceTrackVolumes(
    volumes: Partial<Record<AmbienceSoundId, number>>,
    rampSeconds = 0.35,
  ): void {
    this.ambienceTrackVolumes = { ...volumes }
    this.ambienceLibrary?.setTrackVolumes(volumes, rampSeconds)
  }

  getAmbienceLibrary(): AmbienceLibraryEngine | null {
    return this.ambienceLibrary
  }

  /**
   * Slides the binaural pair from one beat difference to another. The ramp
   * runs in the audio thread for the whole length of the passage.
   */
  setBinauralLadder(
    from: { carrier: number; beat: number },
    to: { carrier: number; beat: number },
    seconds: number,
  ): void {
    this.binaural?.setLadder(from, to, seconds)
  }

  /** The frequencies the pair is playing right now. */
  getBinauralFrequencies(): { left: number; right: number; beat: number } | null {
    if (!this.binaural) return null
    const pair = this.binaural.getFrequencyPair()
    return { left: pair.left, right: pair.right, beat: pair.beat }
  }

  setSessionFade(value: number, rampSeconds = 0.18): void {
    if (!this.context || !this.sessionFadeGain) return
    safeSetTarget(
      this.sessionFadeGain.gain,
      clamp(value, 0.0001, 1),
      this.context.currentTime,
      rampSeconds,
    )
  }

  setSessionAmbientMultiplier(value: number, rampSeconds = 0.5): void {
    if (!this.context || !this.ambientSessionGain) return
    safeSetTarget(
      this.ambientSessionGain.gain,
      clamp(value, 0, 1),
      this.context.currentTime,
      rampSeconds,
    )
  }

  /**
   * Fade the entire shared output (speakers and recording tap) without changing
   * the persisted master volume. Used by the sleep timer.
   */
  scheduleSleepFade(seconds: number): void {
    if (!this.context || !this.sleepFadeGain) return
    const now = this.context.currentTime
    const gain = this.sleepFadeGain.gain
    const duration = Math.max(0.2, seconds)
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(Math.max(0.0001, gain.value), now)
    gain.linearRampToValueAtTime(0.0001, now + duration)
  }

  resetSleepFade(rampSeconds = 0.4): void {
    if (!this.context || !this.sleepFadeGain) return
    const now = this.context.currentTime
    const gain = this.sleepFadeGain.gain
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(Math.max(0.0001, gain.value), now)
    gain.linearRampToValueAtTime(1, now + Math.max(0.05, rampSeconds))
  }

  setRecordingKeepAlive(active: boolean): void {
    this.keepAliveForRecording = active
    if (active) {
      if (this.suspendTimer !== null) {
        window.clearTimeout(this.suspendTimer)
        this.suspendTimer = null
      }
      void this.ensureGraph().catch(() => undefined)
    }
  }

  async startMicrophone(): Promise<AnalyserNode> {
    const context = await this.ensureGraph()
    const analyser = await this.microphone.start(context)
    if (context.state === 'suspended') await context.resume()
    this.micActive = true
    return analyser
  }

  stopMicrophone(): void {
    this.microphone.stop()
    this.micActive = false
  }

  getMicrophoneAnalyser(): AnalyserNode | null {
    return this.microphone.getAnalyser()
  }

  /**
   * A quiet, substantially faded tone used only for optional breathing cues.
   * It follows the same master and recording bus as the rest of the application.
   */
  playBreathCue(phase: 'inhale' | 'hold' | 'exhale' | 'rest'): void {
    if (!this.context || !this.mixBus || !this.playing) return
    const frequencies = {
      inhale: 392,
      hold: 440,
      exhale: 329.63,
      rest: 293.66,
    }
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const partial = this.context.createOscillator()
    const gain = this.context.createGain()
    const pan = this.context.createStereoPanner()
    oscillator.type = 'sine'
    partial.type = 'sine'
    oscillator.frequency.value = frequencies[phase]
    partial.frequency.value = frequencies[phase] * 2.002
    pan.pan.value = phase === 'inhale' || phase === 'hold' ? -0.15 : 0.15
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.016, now + 0.8)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.6)
    const partialGain = this.context.createGain()
    partialGain.gain.setValueAtTime(0.002, now)
    partialGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2)
    oscillator.connect(gain)
    partial.connect(partialGain)
    gain.connect(pan)
    partialGain.connect(pan)
    pan.connect(this.mixBus)
    oscillator.start(now)
    partial.start(now)
    oscillator.stop(now + 3.8)
    partial.stop(now + 3.8)
    oscillator.addEventListener(
      'ended',
      () => {
        oscillator.disconnect()
        partial.disconnect()
        gain.disconnect()
        partialGain.disconnect()
        pan.disconnect()
      },
      { once: true },
    )
  }

  /**
   * A deliberate, unprocessed stereo check. One oscillator feeds the selected
   * side of a ChannelMerger, so the result is hard-panned instead of relying on
   * an HRTF or a spatialiser. It bypasses the recording tap on purpose.
   */
  async playBinauralCheck(channel: 'left' | 'right' | 'both'): Promise<void> {
    const context = await this.ensureGraph()
    this.stopBinauralCheck()
    const now = context.currentTime
    const duration = 1.4
    const merger = context.createChannelMerger(2)
    const gain = context.createGain()
    const oscillators: OscillatorNode[] = []

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.08)
    gain.gain.setValueAtTime(0.075, now + duration - 0.28)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    merger.connect(gain)
    gain.connect(context.destination)

    const addSide = (input: 0 | 1) => {
      const oscillator = context.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = 440
      oscillator.connect(merger, 0, input)
      oscillator.start(now)
      oscillator.stop(now + duration + 0.05)
      oscillators.push(oscillator)
    }

    if (channel !== 'right') addSide(0)
    if (channel !== 'left') addSide(1)

    this.channelTest = { oscillators, merger, gain }
    this.channelTestTimer = window.setTimeout(
      () => this.stopBinauralCheck(),
      duration * 1000 + 100,
    )
  }

  private stopBinauralCheck(): void {
    if (this.channelTestTimer !== null) {
      window.clearTimeout(this.channelTestTimer)
      this.channelTestTimer = null
    }
    const test = this.channelTest
    if (!test) return
    this.channelTest = null
    for (const oscillator of test.oscillators) {
      try {
        oscillator.disconnect()
      } catch {
        // The oscillator may already have ended.
      }
    }
    test.merger.disconnect()
    test.gain.disconnect()
  }

  analyseOutput(): AudioAnalysis {
    if (!this.analyser || !this.playing || this.analyser.context.state !== 'running') {
      return { level: 0, bass: 0 }
    }
    if (!this.timeDomainData) {
      this.timeDomainData = new Uint8Array(this.analyser.fftSize)
    }
    if (!this.frequencyData) {
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
    }
    this.analyser.getByteTimeDomainData(this.timeDomainData)
    this.analyser.getByteFrequencyData(this.frequencyData)
    let sum = 0
    for (let index = 0; index < this.timeDomainData.length; index += 1) {
      const centered = (this.timeDomainData[index] - 128) / 128
      sum += centered * centered
    }
    const rms = Math.sqrt(sum / this.timeDomainData.length)
    const bassBins = Math.max(1, Math.floor(this.frequencyData.length * 0.08))
    let bassTotal = 0
    for (let index = 1; index < bassBins; index += 1) {
      bassTotal += this.frequencyData[index]
    }
    return {
      level: clamp(rms * 5.5, 0, 1),
      bass: clamp(bassTotal / ((bassBins - 1) * 255), 0, 1),
    }
  }

  async recoverIfSuspended(): Promise<boolean> {
    if (!this.context) return false
    if (this.context.state === 'suspended') {
      await this.context.resume()
      return this.playing
    }
    return false
  }

  getDebugSnapshot(): AudioDebugSnapshot {
    return {
      contextState: this.context?.state ?? 'uninitialized',
      initialized: this.initialized,
      playing: this.playing,
      leftFrequency: this.binaural?.getFrequencyPair().left ?? null,
      rightFrequency: this.binaural?.getFrequencyPair().right ?? null,
      binauralEnabled: this.audioConfig.binauralEnabled,
      binauralVolume: this.audioConfig.binauralVolume,
      ambientEnabled: this.audioConfig.ambientEnabled,
      ambientMuted: this.audioConfig.ambientMuted,
      transportGain: this.transportGain?.gain.value ?? 0,
      masterGain: this.masterGain?.gain.value ?? 0,
      mediaDestinationChannels: this.mediaDestination?.channelCount ?? 0,
      micActive: this.micActive,
    }
  }

  dispose(): void {
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer)
      this.suspendTimer = null
    }
    this.stopMicrophone()
    this.stopBinauralCheck()
    this.binaural?.dispose()
    this.ambient?.dispose()
    this.ambienceLibrary?.dispose()
    this.binaural = null
    this.ambient = null
    this.ambienceLibrary = null
    this.mediaDestination?.stream.getTracks().forEach((track) => track.stop())
    this.analyser?.disconnect()
    this.mediaDestination?.disconnect()
    this.limiter?.disconnect()
    this.sleepFadeGain?.disconnect()
    this.masterGain?.disconnect()
    this.transportGain?.disconnect()
    this.sessionFadeGain?.disconnect()
    this.ambientSessionGain?.disconnect()
    this.mixBus?.disconnect()
    this.mediaDestination = null
    this.analyser = null
    this.limiter = null
    this.sleepFadeGain = null
    this.masterGain = null
    this.transportGain = null
    this.sessionFadeGain = null
    this.ambientSessionGain = null
    this.mixBus = null
    this.initialized = false
    this.playing = false
    if (this.context) {
      void this.context.close().catch(() => undefined)
      this.context = null
    }
  }
}

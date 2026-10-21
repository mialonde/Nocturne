import type { AmbienceSoundId } from '../config/ambience'
import {
  clamp,
  createBrownNoiseBuffer,
  createImpulseResponse,
  createNoiseBuffer,
  createWhiteNoiseBuffer,
  safeSetTarget,
} from './audioUtils'

interface SoundVoice {
  id: AmbienceSoundId
  gainNode: GainNode
  stop: () => void
}

export class AmbienceLibraryEngine {
  private readonly context: AudioContext
  private readonly outputNode: GainNode
  private readonly reverbSend: GainNode
  private readonly convolver: ConvolverNode
  private readonly reverbWet: GainNode

  private readonly activeVoices = new Map<AmbienceSoundId, SoundVoice>()
  private targetVolumes: Partial<Record<AmbienceSoundId, number>> = {}
  private masterVolume = 1
  private muted = false
  private disposed = false

  // Cached shared audio buffers for efficiency
  private pinkBuffer: AudioBuffer | null = null
  private whiteBuffer: AudioBuffer | null = null
  private brownBuffer: AudioBuffer | null = null

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context

    this.outputNode = context.createGain()
    this.outputNode.gain.value = 1
    this.outputNode.connect(destination)

    // Shared subtle reverb space
    this.reverbSend = context.createGain()
    this.reverbSend.gain.value = 0.35
    this.convolver = context.createConvolver()
    this.convolver.normalize = true
    this.convolver.buffer = createImpulseResponse(context, 3.6, 2.5)
    this.reverbWet = context.createGain()
    this.reverbWet.gain.value = 0.28

    this.reverbSend.connect(this.convolver)
    this.convolver.connect(this.reverbWet)
    this.reverbWet.connect(this.outputNode)
  }

  private getPinkBuffer(): AudioBuffer {
    if (!this.pinkBuffer) {
      this.pinkBuffer = createNoiseBuffer(this.context, 4)
    }
    return this.pinkBuffer
  }

  private getWhiteBuffer(): AudioBuffer {
    if (!this.whiteBuffer) {
      this.whiteBuffer = createWhiteNoiseBuffer(this.context, 3.5)
    }
    return this.whiteBuffer
  }

  private getBrownBuffer(): AudioBuffer {
    if (!this.brownBuffer) {
      this.brownBuffer = createBrownNoiseBuffer(this.context, 4)
    }
    return this.brownBuffer
  }

  setMaster(volume: number, muted: boolean, rampSeconds = 0.15): void {
    this.masterVolume = clamp(volume, 0, 1)
    this.muted = muted
    if (this.disposed) return
    const target = this.muted ? 0 : this.masterVolume
    safeSetTarget(this.outputNode.gain, target, this.context.currentTime, rampSeconds)
  }

  setTrackVolumes(volumes: Partial<Record<AmbienceSoundId, number>>, rampSeconds = 0.35): void {
    if (this.disposed) return
    this.targetVolumes = { ...volumes }
    const now = this.context.currentTime

    // Process all sound IDs that have target volumes or are currently active
    const allIds = new Set<AmbienceSoundId>([
      ...(Object.keys(volumes) as AmbienceSoundId[]),
      ...(this.activeVoices.keys() as Iterable<AmbienceSoundId>),
    ])

    for (const id of allIds) {
      const vol = clamp(volumes[id] ?? 0, 0, 1)
      const voice = this.activeVoices.get(id)

      if (vol > 0.001) {
        if (!voice) {
          // Instantiate and start this sound
          const newVoice = this.createSoundVoice(id)
          if (newVoice) {
            this.activeVoices.set(id, newVoice)
            // Ramp up from 0
            newVoice.gainNode.gain.setValueAtTime(0.0001, now)
            safeSetTarget(newVoice.gainNode.gain, vol, now, rampSeconds)
          }
        } else {
          // Adjust volume
          safeSetTarget(voice.gainNode.gain, vol, now, rampSeconds)
        }
      } else if (voice) {
        // Ramp down to 0 and terminate voice
        safeSetTarget(voice.gainNode.gain, 0.0001, now, rampSeconds)
        window.setTimeout(() => {
          if (this.disposed) return
          // Check if it's still supposed to be off
          const currentTarget = this.targetVolumes[id] ?? 0
          if (currentTarget <= 0.001) {
            voice.stop()
            this.activeVoices.delete(id)
          }
        }, (rampSeconds + 0.1) * 1000)
      }
    }
  }

  private createSoundVoice(id: AmbienceSoundId): SoundVoice | null {
    const ctx = this.context
    const gainNode = ctx.createGain()
    gainNode.gain.value = 0.0001
    gainNode.connect(this.outputNode)

    const voiceReverbGain = ctx.createGain()
    voiceReverbGain.gain.value = 0.18
    gainNode.connect(voiceReverbGain)
    voiceReverbGain.connect(this.reverbSend)

    const cleanups: (() => void)[] = [
      () => {
        try {
          voiceReverbGain.disconnect()
        } catch {}
      },
    ]

    switch (id) {
      // ==========================================
      // NATURE: rain, storm, forest, wind, ocean
      // ==========================================
      case 'rain': {
        // Continuous rain bed: filtered pink noise
        const src = ctx.createBufferSource()
        src.buffer = this.getPinkBuffer()
        src.loop = true

        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 1150
        bp.Q.value = 0.75

        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 3400
        lp.Q.value = 0.3

        src.connect(bp)
        bp.connect(lp)
        lp.connect(gainNode)
        src.start()
        cleanups.push(() => {
          try {
            src.stop()
            src.disconnect()
            bp.disconnect()
            lp.disconnect()
          } catch {}
        })

        // Raindrop micro-droplets
        let dropTimer: number | null = null
        const scheduleDrop = () => {
          if (this.disposed || !this.activeVoices.has('rain')) return
          const dropTime = ctx.currentTime
          const osc = ctx.createOscillator()
          const dropGain = ctx.createGain()
          const panner = ctx.createStereoPanner()

          const freq = 2400 + Math.random() * 2200
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, dropTime)
          osc.frequency.exponentialRampToValueAtTime(freq * 0.45, dropTime + 0.035)

          const dropVol = 0.02 + Math.random() * 0.05
          dropGain.gain.setValueAtTime(dropVol, dropTime)
          dropGain.gain.exponentialRampToValueAtTime(0.0001, dropTime + 0.04)

          panner.pan.value = Math.random() * 1.6 - 0.8

          osc.connect(dropGain)
          dropGain.connect(panner)
          panner.connect(gainNode)

          osc.start(dropTime)
          osc.stop(dropTime + 0.05)
          osc.onended = () => {
            osc.disconnect()
            dropGain.disconnect()
            panner.disconnect()
          }

          dropTimer = window.setTimeout(scheduleDrop, 40 + Math.random() * 90)
        }
        scheduleDrop()
        cleanups.push(() => {
          if (dropTimer !== null) window.clearTimeout(dropTimer)
        })
        break
      }

      case 'storm': {
        // Deep rumble bed
        const src = ctx.createBufferSource()
        src.buffer = this.getBrownBuffer()
        src.loop = true

        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 160
        filter.Q.value = 1.2

        // LFO sweeping rumble
        const lfo = ctx.createOscillator()
        lfo.frequency.value = 0.035
        const lfoDepth = ctx.createGain()
        lfoDepth.gain.value = 80
        lfo.connect(lfoDepth)
        lfoDepth.connect(filter.frequency)
        lfo.start()

        src.connect(filter)
        filter.connect(gainNode)
        src.start()

        // Sub bass sine foundation
        const sub = ctx.createOscillator()
        sub.type = 'sine'
        sub.frequency.value = 38
        const subGain = ctx.createGain()
        subGain.gain.value = 0.22
        sub.connect(subGain)
        subGain.connect(gainNode)
        sub.start()

        // Scheduled thunder strikes
        let thunderTimer: number | null = null
        const scheduleThunder = () => {
          if (this.disposed || !this.activeVoices.has('storm')) return
          const strikeTime = ctx.currentTime
          const thunderOsc = ctx.createOscillator()
          thunderOsc.type = 'triangle'
          thunderOsc.frequency.setValueAtTime(56, strikeTime)
          thunderOsc.frequency.exponentialRampToValueAtTime(28, strikeTime + 4.5)

          const strikeGain = ctx.createGain()
          strikeGain.gain.setValueAtTime(0.0001, strikeTime)
          strikeGain.gain.linearRampToValueAtTime(0.35, strikeTime + 0.5)
          strikeGain.gain.exponentialRampToValueAtTime(0.0001, strikeTime + 6.5)

          const panner = ctx.createStereoPanner()
          panner.pan.value = Math.random() * 1.4 - 0.7

          thunderOsc.connect(strikeGain)
          strikeGain.connect(panner)
          panner.connect(gainNode)

          thunderOsc.start(strikeTime)
          thunderOsc.stop(strikeTime + 7)
          thunderOsc.onended = () => {
            thunderOsc.disconnect()
            strikeGain.disconnect()
            panner.disconnect()
          }

          thunderTimer = window.setTimeout(scheduleThunder, 13000 + Math.random() * 14000)
        }
        thunderTimer = window.setTimeout(scheduleThunder, 3000)

        cleanups.push(() => {
          if (thunderTimer !== null) window.clearTimeout(thunderTimer)
          try {
            src.stop()
            sub.stop()
            lfo.stop()
            src.disconnect()
            filter.disconnect()
            sub.disconnect()
            lfo.disconnect()
          } catch {}
        })
        break
      }

      case 'forest': {
        // Wind through canopy
        const src = ctx.createBufferSource()
        src.buffer = this.getPinkBuffer()
        src.loop = true

        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 680
        bp.Q.value = 0.45

        const lfo = ctx.createOscillator()
        lfo.frequency.value = 0.04
        const lfoDepth = ctx.createGain()
        lfoDepth.gain.value = 160
        lfo.connect(lfoDepth)
        lfoDepth.connect(bp.frequency)
        lfo.start()

        src.connect(bp)
        bp.connect(gainNode)
        src.start()

        // Procedural bird chirps
        let birdTimer: number | null = null
        const scheduleBird = () => {
          if (this.disposed || !this.activeVoices.has('forest')) return
          const t = ctx.currentTime
          const osc = ctx.createOscillator()
          const bGain = ctx.createGain()
          const panner = ctx.createStereoPanner()

          const baseFreq = 2600 + Math.random() * 900
          osc.type = 'sine'
          osc.frequency.setValueAtTime(baseFreq, t)
          osc.frequency.linearRampToValueAtTime(baseFreq * 1.35, t + 0.06)
          osc.frequency.linearRampToValueAtTime(baseFreq * 1.1, t + 0.12)

          bGain.gain.setValueAtTime(0.0001, t)
          bGain.gain.linearRampToValueAtTime(0.035, t + 0.03)
          bGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)

          panner.pan.value = Math.random() * 1.4 - 0.7

          osc.connect(bGain)
          bGain.connect(panner)
          panner.connect(gainNode)
          panner.connect(this.reverbSend)

          osc.start(t)
          osc.stop(t + 0.18)
          osc.onended = () => {
            osc.disconnect()
            bGain.disconnect()
            panner.disconnect()
          }

          birdTimer = window.setTimeout(scheduleBird, 4500 + Math.random() * 6500)
        }
        birdTimer = window.setTimeout(scheduleBird, 2000)

        cleanups.push(() => {
          if (birdTimer !== null) window.clearTimeout(birdTimer)
          try {
            src.stop()
            lfo.stop()
            src.disconnect()
            bp.disconnect()
            lfo.disconnect()
          } catch {}
        })
        break
      }

      case 'wind': {
        // Dual sweeping resonant bandpass filters
        const src = ctx.createBufferSource()
        src.buffer = this.getPinkBuffer()
        src.loop = true

        const bp1 = ctx.createBiquadFilter()
        bp1.type = 'bandpass'
        bp1.frequency.value = 360
        bp1.Q.value = 1.1

        const bp2 = ctx.createBiquadFilter()
        bp2.type = 'bandpass'
        bp2.frequency.value = 750
        bp2.Q.value = 0.9

        const lfo1 = ctx.createOscillator()
        lfo1.frequency.value = 0.022
        const lfo1Depth = ctx.createGain()
        lfo1Depth.gain.value = 180
        lfo1.connect(lfo1Depth)
        lfo1Depth.connect(bp1.frequency)
        lfo1.start()

        const lfo2 = ctx.createOscillator()
        lfo2.frequency.value = 0.051
        const lfo2Depth = ctx.createGain()
        lfo2Depth.gain.value = 260
        lfo2.connect(lfo2Depth)
        lfo2Depth.connect(bp2.frequency)
        lfo2.start()

        const mix = ctx.createGain()
        mix.gain.value = 1.4
        src.connect(bp1)
        src.connect(bp2)
        bp1.connect(mix)
        bp2.connect(mix)
        mix.connect(gainNode)
        src.start()

        cleanups.push(() => {
          try {
            src.stop()
            lfo1.stop()
            lfo2.stop()
            src.disconnect()
            bp1.disconnect()
            bp2.disconnect()
            mix.disconnect()
          } catch {}
        })
        break
      }

      case 'ocean': {
        // Cyclic wave wash
        const src = ctx.createBufferSource()
        src.buffer = this.getPinkBuffer()
        src.loop = true

        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 400
        filter.Q.value = 0.6

        const waveGain = ctx.createGain()
        waveGain.gain.value = 0.5

        // Dual LFO to simulate 11-second wave swells
        const waveLfo = ctx.createOscillator()
        waveLfo.frequency.value = 0.091
        const waveLfoGain = ctx.createGain()
        waveLfoGain.gain.value = 0.38
        waveLfo.connect(waveLfoGain)
        waveLfoGain.connect(waveGain.gain)
        waveLfo.start()

        const filterLfo = ctx.createOscillator()
        filterLfo.frequency.value = 0.091
        const filterLfoGain = ctx.createGain()
        filterLfoGain.gain.value = 950
        filterLfo.connect(filterLfoGain)
        filterLfoGain.connect(filter.frequency)
        filterLfo.start()

        src.connect(filter)
        filter.connect(waveGain)
        waveGain.connect(gainNode)
        waveGain.connect(this.reverbSend)
        src.start()

        cleanups.push(() => {
          try {
            src.stop()
            waveLfo.stop()
            filterLfo.stop()
            src.disconnect()
            filter.disconnect()
            waveGain.disconnect()
          } catch {}
        })
        break
      }

      // ==========================================
      // NOISE: white, pink, brown, fan, ventilation
      // ==========================================
      case 'white_noise': {
        const src = ctx.createBufferSource()
        src.buffer = this.getWhiteBuffer()
        src.loop = true

        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 9500
        lp.Q.value = 0.2

        src.connect(lp)
        lp.connect(gainNode)
        src.start()

        cleanups.push(() => {
          try {
            src.stop()
            src.disconnect()
            lp.disconnect()
          } catch {}
        })
        break
      }

      case 'pink_noise': {
        const src = ctx.createBufferSource()
        src.buffer = this.getPinkBuffer()
        src.loop = true

        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 5500
        lp.Q.value = 0.2

        src.connect(lp)
        lp.connect(gainNode)
        src.start()

        cleanups.push(() => {
          try {
            src.stop()
            src.disconnect()
            lp.disconnect()
          } catch {}
        })
        break
      }

      case 'brown_noise': {
        const src = ctx.createBufferSource()
        src.buffer = this.getBrownBuffer()
        src.loop = true

        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 850
        lp.Q.value = 0.4

        src.connect(lp)
        lp.connect(gainNode)
        src.start()

        cleanups.push(() => {
          try {
            src.stop()
            src.disconnect()
            lp.disconnect()
          } catch {}
        })
        break
      }

      case 'fan': {
        // 60Hz and 120Hz motor hum
        const osc1 = ctx.createOscillator()
        osc1.type = 'triangle'
        osc1.frequency.value = 60
        const osc2 = ctx.createOscillator()
        osc2.type = 'sine'
        osc2.frequency.value = 120

        const motorGain = ctx.createGain()
        motorGain.gain.value = 0.14
        osc1.connect(motorGain)
        osc2.connect(motorGain)
        osc1.start()
        osc2.start()

        // Blade airflow noise with flutter
        const airSrc = ctx.createBufferSource()
        airSrc.buffer = this.getPinkBuffer()
        airSrc.loop = true

        const airFilter = ctx.createBiquadFilter()
        airFilter.type = 'lowpass'
        airFilter.frequency.value = 460

        const airGain = ctx.createGain()
        airGain.gain.value = 0.45

        // Blade rotation flutter (24Hz)
        const flutter = ctx.createOscillator()
        flutter.frequency.value = 24
        const flutterDepth = ctx.createGain()
        flutterDepth.gain.value = 0.08
        flutter.connect(flutterDepth)
        flutterDepth.connect(airGain.gain)
        flutter.start()

        airSrc.connect(airFilter)
        airFilter.connect(airGain)
        airGain.connect(gainNode)
        motorGain.connect(gainNode)
        airSrc.start()

        cleanups.push(() => {
          try {
            osc1.stop()
            osc2.stop()
            flutter.stop()
            airSrc.stop()
            osc1.disconnect()
            osc2.disconnect()
            airSrc.disconnect()
            motorGain.disconnect()
            airGain.disconnect()
          } catch {}
        })
        break
      }

      case 'ventilation': {
        // Constant HVAC room air
        const src = ctx.createBufferSource()
        src.buffer = this.getPinkBuffer()
        src.loop = true

        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 520
        filter.Q.value = 0.3

        // Duct resonance peak
        const ductRes = ctx.createBiquadFilter()
        ductRes.type = 'bandpass'
        ductRes.frequency.value = 82
        ductRes.Q.value = 2.4

        const resGain = ctx.createGain()
        resGain.gain.value = 0.16

        src.connect(filter)
        filter.connect(gainNode)

        src.connect(ductRes)
        ductRes.connect(resGain)
        resGain.connect(gainNode)

        src.start()

        cleanups.push(() => {
          try {
            src.stop()
            src.disconnect()
            filter.disconnect()
            ductRes.disconnect()
            resGain.disconnect()
          } catch {}
        })
        break
      }

      // ==========================================
      // SLEEP: night_crickets, fireplace, distant_thunder
      // ==========================================
      case 'night_crickets': {
        // 4.8kHz sine modulated by 18Hz pulse
        const carrier1 = ctx.createOscillator()
        carrier1.type = 'sine'
        carrier1.frequency.value = 4780

        const carrier2 = ctx.createOscillator()
        carrier2.type = 'sine'
        carrier2.frequency.value = 4920

        const amMod = ctx.createOscillator()
        amMod.frequency.value = 18.5
        const amDepth = ctx.createGain()
        amDepth.gain.value = 0.5

        const amCenter = ctx.createGain()
        amCenter.gain.value = 0.5
        amMod.connect(amDepth)

        const cricketGain = ctx.createGain()
        cricketGain.gain.value = 0.08

        carrier1.connect(cricketGain)
        carrier2.connect(cricketGain)

        // Phrasing envelope (chirp bursts followed by rest)
        let cricketTimer: number | null = null
        const pulseCrickets = () => {
          if (this.disposed || !this.activeVoices.has('night_crickets')) return
          const t = ctx.currentTime
          const bursts = 3 + Math.floor(Math.random() * 3)
          let timeOffset = 0
          for (let i = 0; i < bursts; i += 1) {
            cricketGain.gain.setValueAtTime(0.0001, t + timeOffset)
            cricketGain.gain.linearRampToValueAtTime(0.065, t + timeOffset + 0.04)
            cricketGain.gain.linearRampToValueAtTime(0.0001, t + timeOffset + 0.14)
            timeOffset += 0.22
          }
          cricketTimer = window.setTimeout(pulseCrickets, (timeOffset + 0.6 + Math.random() * 1.4) * 1000)
        }
        pulseCrickets()

        cricketGain.connect(gainNode)
        cricketGain.connect(this.reverbSend)
        carrier1.start()
        carrier2.start()
        amMod.start()

        cleanups.push(() => {
          if (cricketTimer !== null) window.clearTimeout(cricketTimer)
          try {
            carrier1.stop()
            carrier2.stop()
            amMod.stop()
            carrier1.disconnect()
            carrier2.disconnect()
            cricketGain.disconnect()
          } catch {}
        })
        break
      }

      case 'fireplace': {
        // Hearth warm rumble
        const src = ctx.createBufferSource()
        src.buffer = this.getBrownBuffer()
        src.loop = true

        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 240
        src.connect(filter)
        filter.connect(gainNode)
        src.start()

        // Wood crackle & pop generator
        let popTimer: number | null = null
        const schedulePop = () => {
          if (this.disposed || !this.activeVoices.has('fireplace')) return
          const t = ctx.currentTime
          const isLoudPop = Math.random() < 0.22

          // Micro noise burst
          const popSrc = ctx.createBufferSource()
          popSrc.buffer = this.getWhiteBuffer()
          const popHp = ctx.createBiquadFilter()
          popHp.type = 'highpass'
          popHp.frequency.value = isLoudPop ? 1400 : 2800

          const popGain = ctx.createGain()
          const popVol = isLoudPop ? 0.08 + Math.random() * 0.12 : 0.015 + Math.random() * 0.03
          const popDur = isLoudPop ? 0.03 : 0.012

          popGain.gain.setValueAtTime(popVol, t)
          popGain.gain.exponentialRampToValueAtTime(0.0001, t + popDur)

          const panner = ctx.createStereoPanner()
          panner.pan.value = Math.random() * 1.2 - 0.6

          popSrc.connect(popHp)
          popHp.connect(popGain)
          popGain.connect(panner)
          panner.connect(gainNode)

          popSrc.start(t)
          popSrc.stop(t + popDur + 0.01)
          popSrc.onended = () => {
            popSrc.disconnect()
            popHp.disconnect()
            popGain.disconnect()
            panner.disconnect()
          }

          popTimer = window.setTimeout(schedulePop, 40 + Math.random() * 180)
        }
        schedulePop()

        cleanups.push(() => {
          if (popTimer !== null) window.clearTimeout(popTimer)
          try {
            src.stop()
            src.disconnect()
            filter.disconnect()
          } catch {}
        })
        break
      }

      case 'distant_thunder': {
        // Constant very low air vibration
        const sub = ctx.createOscillator()
        sub.type = 'sine'
        sub.frequency.value = 32
        const subGain = ctx.createGain()
        subGain.gain.value = 0.15
        sub.connect(subGain)
        subGain.connect(gainNode)
        sub.start()

        // Periodic rolling distant thunder
        let thunderRollTimer: number | null = null
        const scheduleRoll = () => {
          if (this.disposed || !this.activeVoices.has('distant_thunder')) return
          const t = ctx.currentTime
          const osc = ctx.createOscillator()
          osc.type = 'triangle'
          osc.frequency.setValueAtTime(48, t)
          osc.frequency.exponentialRampToValueAtTime(26, t + 5.5)

          const rGain = ctx.createGain()
          rGain.gain.setValueAtTime(0.0001, t)
          rGain.gain.linearRampToValueAtTime(0.4, t + 1.2)
          rGain.gain.exponentialRampToValueAtTime(0.0001, t + 7.5)

          const panner = ctx.createStereoPanner()
          panner.pan.value = Math.random() * 1.4 - 0.7

          osc.connect(rGain)
          rGain.connect(panner)
          panner.connect(gainNode)
          panner.connect(this.reverbSend)

          osc.start(t)
          osc.stop(t + 8)
          osc.onended = () => {
            osc.disconnect()
            rGain.disconnect()
            panner.disconnect()
          }

          thunderRollTimer = window.setTimeout(scheduleRoll, 14000 + Math.random() * 16000)
        }
        thunderRollTimer = window.setTimeout(scheduleRoll, 2500)

        cleanups.push(() => {
          if (thunderRollTimer !== null) window.clearTimeout(thunderRollTimer)
          try {
            sub.stop()
            sub.disconnect()
            subGain.disconnect()
          } catch {}
        })
        break
      }

      // ==========================================
      // COSMIC: spatial_drone, deep_resonance, synthetic_atmosphere
      // ==========================================
      case 'spatial_drone': {
        // Multi-octave detuned oscillators
        const freqs = [55, 82.4, 110]
        const oscs: OscillatorNode[] = []
        const panner = ctx.createStereoPanner()

        // Slow pan rotation
        const panLfo = ctx.createOscillator()
        panLfo.frequency.value = 0.025
        panLfo.connect(panner.pan)
        panLfo.start()

        const droneFilter = ctx.createBiquadFilter()
        droneFilter.type = 'lowpass'
        droneFilter.frequency.value = 240
        droneFilter.Q.value = 0.8

        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          osc.type = idx === 1 ? 'sine' : 'triangle'
          osc.frequency.value = freq
          osc.detune.value = (idx - 1) * 3.5
          osc.connect(droneFilter)
          osc.start()
          oscs.push(osc)
        })

        droneFilter.connect(panner)
        panner.connect(gainNode)
        panner.connect(this.reverbSend)

        cleanups.push(() => {
          try {
            oscs.forEach((o) => o.stop())
            panLfo.stop()
            oscs.forEach((o) => o.disconnect())
            panLfo.disconnect()
            droneFilter.disconnect()
            panner.disconnect()
          } catch {}
        })
        break
      }

      case 'deep_resonance': {
        // Singing bowl harmonic modes (54, 108, 216, 432 Hz)
        const modes = [54, 108, 216.5, 432.2]
        const oscs: OscillatorNode[] = []
        const gains: GainNode[] = []

        modes.forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          osc.type = 'sine'
          osc.frequency.value = freq
          osc.detune.value = (idx - 1.5) * 1.8

          const g = ctx.createGain()
          g.gain.value = 0.25 / (idx + 1)
          osc.connect(g)
          g.connect(gainNode)
          g.connect(this.reverbSend)
          osc.start()

          oscs.push(osc)
          gains.push(g)
        })

        cleanups.push(() => {
          try {
            oscs.forEach((o) => o.stop())
            oscs.forEach((o) => o.disconnect())
            gains.forEach((g) => g.disconnect())
          } catch {}
        })
        break
      }

      case 'synthetic_atmosphere': {
        // Ethereal chord pad: minor 9th (D, F, A, C, E)
        const chordFreqs = [146.83, 174.61, 220, 261.63, 329.63]
        const oscs: OscillatorNode[] = []

        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 850
        filter.Q.value = 0.45

        const lfo = ctx.createOscillator()
        lfo.frequency.value = 0.045
        const lfoDepth = ctx.createGain()
        lfoDepth.gain.value = 240
        lfo.connect(lfoDepth)
        lfoDepth.connect(filter.frequency)
        lfo.start()

        chordFreqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          osc.type = 'triangle'
          osc.frequency.value = freq
          osc.detune.value = (idx % 2 === 0 ? 1 : -1) * 4
          osc.connect(filter)
          osc.start()
          oscs.push(osc)
        })

        const padGain = ctx.createGain()
        padGain.gain.value = 0.18

        filter.connect(padGain)
        padGain.connect(gainNode)
        padGain.connect(this.reverbSend)

        cleanups.push(() => {
          try {
            oscs.forEach((o) => o.stop())
            lfo.stop()
            oscs.forEach((o) => o.disconnect())
            lfo.disconnect()
            filter.disconnect()
            padGain.disconnect()
          } catch {}
        })
        break
      }

      // ==========================================
      // TONAL: minimal_ambient, long_pads, low_intensity_tones
      // ==========================================
      case 'minimal_ambient': {
        // Generative quiet pentatonic notes
        const scale = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66]
        let noteTimer: number | null = null

        const playNote = () => {
          if (this.disposed || !this.activeVoices.has('minimal_ambient')) return
          const t = ctx.currentTime
          const freq = scale[Math.floor(Math.random() * scale.length)] ?? 220
          const osc = ctx.createOscillator()
          osc.type = Math.random() > 0.5 ? 'sine' : 'triangle'
          osc.frequency.setValueAtTime(freq, t)

          const nGain = ctx.createGain()
          nGain.gain.setValueAtTime(0.0001, t)
          nGain.gain.linearRampToValueAtTime(0.12, t + 0.4)
          nGain.gain.exponentialRampToValueAtTime(0.0001, t + 4.8)

          const panner = ctx.createStereoPanner()
          panner.pan.value = Math.random() * 1.4 - 0.7

          osc.connect(nGain)
          nGain.connect(panner)
          panner.connect(gainNode)
          panner.connect(this.reverbSend)

          osc.start(t)
          osc.stop(t + 5.2)
          osc.onended = () => {
            osc.disconnect()
            nGain.disconnect()
            panner.disconnect()
          }

          noteTimer = window.setTimeout(playNote, 3200 + Math.random() * 4500)
        }
        playNote()

        cleanups.push(() => {
          if (noteTimer !== null) window.clearTimeout(noteTimer)
        })
        break
      }

      case 'long_pads': {
        // Warm slow-blooming analog pad
        const root = 130.81 // C3
        const fifth = 196.0 // G3
        const octave = 261.63 // C4

        const osc1 = ctx.createOscillator()
        osc1.type = 'sawtooth'
        osc1.frequency.value = root
        const osc2 = ctx.createOscillator()
        osc2.type = 'triangle'
        osc2.frequency.value = fifth
        const osc3 = ctx.createOscillator()
        osc3.type = 'sawtooth'
        osc3.frequency.value = octave
        osc3.detune.value = 5

        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 420
        lp.Q.value = 1.2

        const padMix = ctx.createGain()
        padMix.gain.value = 0.15

        osc1.connect(lp)
        osc2.connect(lp)
        osc3.connect(lp)
        lp.connect(padMix)
        padMix.connect(gainNode)
        padMix.connect(this.reverbSend)

        osc1.start()
        osc2.start()
        osc3.start()

        cleanups.push(() => {
          try {
            osc1.stop()
            osc2.stop()
            osc3.stop()
            osc1.disconnect()
            osc2.disconnect()
            osc3.disconnect()
            lp.disconnect()
            padMix.disconnect()
          } catch {}
        })
        break
      }

      case 'low_intensity_tones': {
        // Pure 43.6Hz sub tone with zero cognitive clutter
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 43.65

        const osc2 = ctx.createOscillator()
        osc2.type = 'triangle'
        osc2.frequency.value = 65.48
        osc2.detune.value = 2

        const subGain = ctx.createGain()
        subGain.gain.value = 0.28

        osc.connect(subGain)
        osc2.connect(subGain)
        subGain.connect(gainNode)

        osc.start()
        osc2.start()

        cleanups.push(() => {
          try {
            osc.stop()
            osc2.stop()
            osc.disconnect()
            osc2.disconnect()
            subGain.disconnect()
          } catch {}
        })
        break
      }
    }

    return {
      id,
      gainNode,
      stop: () => {
        cleanups.forEach((fn) => fn())
        try {
          gainNode.disconnect()
        } catch {}
      },
    }
  }

  isAnyTrackActive(): boolean {
    return this.activeVoices.size > 0
  }

  getActiveTrackCount(): number {
    return this.activeVoices.size
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    for (const voice of this.activeVoices.values()) {
      voice.stop()
    }
    this.activeVoices.clear()

    try {
      this.outputNode.disconnect()
      this.reverbSend.disconnect()
      this.convolver.disconnect()
      this.reverbWet.disconnect()
    } catch {}
  }
}

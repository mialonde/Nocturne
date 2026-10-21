import { describe, expect, it } from 'vitest'
import { createStarterSession } from '../config/sessions'
import { DEFAULT_FEATURE_SETTINGS } from '../config/featureSettings'
import type { NocturneState } from '../store/useNocturneStore'
import { getBackupPreferences, parseBackup, serializeBackup } from './backup'

function state(): NocturneState {
  return {
    language: 'tr', theme: 'ether', ambientProfile: 'user_mix_test',
    audio: { carrier: 200, beat: 10, masterVolume: 0.66, binauralVolume: 0.38, binauralEnabled: true,
      modulation: false, ambientEnabled: true, ambientMuted: false, ambientMaster: 0.62,
      reverbEnabled: true, layers: { drone: 0.72, harmony: 0.56, wind: 0.44, resonance: 0.34 } },
    visuals: { quality: 'auto', particleDensity: 0.7, bloom: 0.68, contrast: 1.02, intensity: 0.82, reducedMotion: false },
    breathPattern: { inhale: 4, hold: 2, exhale: 6, rest: 2 }, breathCues: true,
    recording: { aspect: '16:9', resolution: 1080, fps: 30, quality: 'high', includeAudio: true, cleanCapture: true },
    sessions: [createStarterSession()], fullscreenShortcut: 'shift+f',
    ambienceTrackVolumes: { rain: 0.5 }, ambienceFavorites: ['rain'],
    userMixes: [{ id: 'user_mix_test', name: 'My mix', description: '', tracks: { rain: 0.5 }, isPreset: false, createdAt: 100 }],
    activeMixId: 'user_mix_test', atmosphereDrivesSoundscape: false,
    features: { ...DEFAULT_FEATURE_SETTINGS, audioOnly: true, livingEnabled: true },
  } as NocturneState
}

describe('full backup exchange', () => {
  it('restores preferences, IDs, sessions, mixes and binary audio without starting tones', async () => {
    const original = state()
    original.sessions[0].note = ''
    original.sessions[0].segments[0].automation = { visualIntensityTo: 0.3, bloomTo: 0.2, ambientTo: 0.1, cameraMotionTo: 0 }
    const blob = new Blob([new Uint8Array([0, 255, 4, 99])], { type: 'audio/wav' })
    const restored = parseBackup(await serializeBackup(original, { name: 'voice.wav', blob }), getBackupPreferences(original))
    expect(restored.preferences.sessions).toEqual(original.sessions)
    expect(restored.preferences.userMixes).toEqual(original.userMixes)
    expect(restored.preferences.audio.binauralEnabled).toBe(false)
    expect(restored.preferences.features.audioOnly).toBe(true)
    expect(restored.audioFile?.name).toBe('voice.wav')
    expect(new Uint8Array(await restored.audioFile!.blob.arrayBuffer())).toEqual(new Uint8Array([0, 255, 4, 99]))
    expect(restored.preferences).not.toHaveProperty('audioStatus')
    expect(restored.preferences).not.toHaveProperty('setTheme')
  })

  it('rejects unsupported versions, corrupt audio and duplicate library IDs', async () => {
    const current = state()
    const envelope = JSON.parse(await serializeBackup(current, null))
    const defaults = getBackupPreferences(current)
    expect(() => parseBackup(JSON.stringify({ ...envelope, version: 2 }), defaults)).toThrow('Unsupported')
    expect(() => parseBackup(JSON.stringify({ ...envelope, audioFile: { base64: '###' } }), defaults)).toThrow()
    envelope.preferences.sessions.push(envelope.preferences.sessions[0])
    expect(() => parseBackup(JSON.stringify(envelope), defaults)).toThrow('duplicate')
  })

  it('clamps unsafe settings and drops unknown track IDs', async () => {
    const current = state()
    const envelope = JSON.parse(await serializeBackup(current, null))
    envelope.preferences.audio.masterVolume = 999
    envelope.preferences.features.voiceEverySec = -1
    envelope.preferences.features.audioOnly = 'true'
    envelope.preferences.ambienceTrackVolumes = { rain: 5, unknown: 1 }
    const restored = parseBackup(JSON.stringify(envelope), getBackupPreferences(current))
    expect(restored.preferences.audio.masterVolume).toBe(1)
    expect(restored.preferences.features.voiceEverySec).toBe(30)
    expect(restored.preferences.features.audioOnly).toBe(false)
    expect(restored.preferences.ambienceTrackVolumes).toEqual({ rain: 1 })
  })
})

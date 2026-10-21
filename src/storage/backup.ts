import type { NocturneState } from '../store/useNocturneStore'
import { isThemeId } from '../config/themes'
import { AMBIENCE_SOUNDS, type AmbienceMix, type AmbienceSoundId } from '../config/ambience'
import { sanitizeFeatures } from '../config/featureSettings'
import { isLanguageCode } from '../language/types'
import { parseSessionFile } from '../session/sessionFile'
import { MAX_PERSONAL_AUDIO_BYTES, type PersonalAudioFile } from './personalAudio'

const KEYS = ['language', 'theme', 'ambientProfile', 'audio', 'breathPattern', 'breathCues',
  'visuals', 'recording', 'sessions', 'fullscreenShortcut', 'ambienceTrackVolumes',
  'ambienceFavorites', 'userMixes', 'activeMixId', 'atmosphereDrivesSoundscape', 'features'] as const
export type BackupPreferences = Pick<NocturneState, typeof KEYS[number]>
export const MAX_BACKUP_BYTES = 32 * 1024 * 1024

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid backup object.')
  return value as Record<string, unknown>
}
function number(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
}
function text(value: unknown, fallback = '', max = 120): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback
}
function tracks(value: unknown): Partial<Record<AmbienceSoundId, number>> {
  const result: Partial<Record<AmbienceSoundId, number>> = {}
  for (const [id, volume] of Object.entries(record(value))) {
    if (Object.hasOwn(AMBIENCE_SOUNDS, id) && typeof volume === 'number' && Number.isFinite(volume)) {
      result[id as AmbienceSoundId] = Math.max(0, Math.min(1, volume))
    }
  }
  return result
}

export function getBackupPreferences(state: NocturneState): BackupPreferences {
  return Object.fromEntries(KEYS.map((key) => [key, state[key]])) as BackupPreferences
}

export async function serializeBackup(state: NocturneState, file: PersonalAudioFile | null): Promise<string> {
  let audioFile = null
  if (file) {
    if (file.blob.size > MAX_PERSONAL_AUDIO_BYTES) throw new Error('Audio file exceeds 20 MB.')
    const bytes = new Uint8Array(await file.blob.arrayBuffer())
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
    }
    audioFile = { name: file.name, type: file.blob.type, base64: btoa(binary) }
  }
  return JSON.stringify({ format: 'nocturne-backup', version: 1, exportedAt: new Date().toISOString(),
    preferences: getBackupPreferences(state), audioFile })
}

export function parseBackup(raw: string, defaults: BackupPreferences): {
  preferences: BackupPreferences; audioFile: PersonalAudioFile | null
} {
  if (new Blob([raw]).size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 32 MB.')
  const envelope = record(JSON.parse(raw))
  if (envelope.format !== 'nocturne-backup' || envelope.version !== 1) throw new Error('Unsupported backup format or version.')
  const saved = record(envelope.preferences)
  const audio = record(saved.audio)
  const layers = record(audio.layers)
  const visuals = record(saved.visuals)
  const breathing = record(saved.breathPattern)
  const recording = record(saved.recording)
  if (!Array.isArray(saved.sessions) || saved.sessions.length > 128 ||
      !Array.isArray(saved.userMixes) || saved.userMixes.length > 128 ||
      !Array.isArray(saved.ambienceFavorites)) throw new Error('Invalid backup library.')
  const sessionIds = new Set<string>()
  const sessions = saved.sessions.map((value) => {
    const source = record(value)
    const session = parseSessionFile(JSON.stringify(source))
    const id = text(source.id)
    if (!id || sessionIds.has(id)) throw new Error('Invalid or duplicate session ID.')
    sessionIds.add(id)
    return { ...session, id }
  })
  const mixIds = new Set<string>()
  const userMixes: AmbienceMix[] = saved.userMixes.map((value) => {
    const mix = record(value)
    const id = text(mix.id)
    if (!id || mixIds.has(id)) throw new Error('Invalid or duplicate mix ID.')
    mixIds.add(id)
    return { id, name: text(mix.name, 'Mix'), description: text(mix.description, '', 400),
      isPreset: false, tracks: tracks(mix.tracks), createdAt: number(mix.createdAt, Date.now(), 0, 9e15) }
  })
  const preferences: BackupPreferences = {
    language: isLanguageCode(saved.language) ? saved.language : defaults.language,
    theme: isThemeId(saved.theme) ? saved.theme : defaults.theme,
    ambientProfile: text(saved.ambientProfile, defaults.ambientProfile),
    audio: {
      carrier: number(audio.carrier, 200, 100, 500), beat: number(audio.beat, 10, 0.5, 40),
      masterVolume: number(audio.masterVolume, 0.66, 0, 1), binauralVolume: number(audio.binauralVolume, 0.38, 0, 1),
      binauralEnabled: false, modulation: audio.modulation === true,
      ambientEnabled: audio.ambientEnabled !== false, ambientMuted: audio.ambientMuted === true,
      ambientMaster: number(audio.ambientMaster, 0.62, 0, 1), reverbEnabled: audio.reverbEnabled !== false,
      layers: { drone: number(layers.drone, 0.72, 0, 1), harmony: number(layers.harmony, 0.56, 0, 1),
        wind: number(layers.wind, 0.44, 0, 1), resonance: number(layers.resonance, 0.34, 0, 1) },
    },
    visuals: {
      quality: ['auto', 'high', 'balanced', 'low'].includes(String(visuals.quality)) ? visuals.quality as typeof defaults.visuals.quality : 'auto',
      particleDensity: number(visuals.particleDensity, 0.7, 0, 1), bloom: number(visuals.bloom, 0.68, 0, 1.5),
      contrast: number(visuals.contrast, 1.02, 0.7, 1.4), intensity: number(visuals.intensity, 0.82, 0.2, 1.4),
      reducedMotion: visuals.reducedMotion === true,
    },
    breathPattern: { inhale: number(breathing.inhale, 4, 1, 60), hold: number(breathing.hold, 2, 0, 60),
      exhale: number(breathing.exhale, 6, 1, 60), rest: number(breathing.rest, 2, 0, 60) },
    breathCues: saved.breathCues === true,
    recording: {
      aspect: ['16:9', '9:16', '1:1'].includes(String(recording.aspect)) ? recording.aspect as typeof defaults.recording.aspect : '16:9',
      resolution: recording.resolution === 720 || recording.resolution === 1440 ? recording.resolution : 1080,
      fps: recording.fps === 60 ? 60 : 30,
      quality: recording.quality === 'compact' || recording.quality === 'balanced' ? recording.quality : 'high',
      includeAudio: recording.includeAudio !== false, cleanCapture: recording.cleanCapture !== false,
    },
    sessions, userMixes,
    ambienceTrackVolumes: tracks(saved.ambienceTrackVolumes),
    ambienceFavorites: saved.ambienceFavorites.filter((id): id is AmbienceSoundId => typeof id === 'string' && Object.hasOwn(AMBIENCE_SOUNDS, id)),
    fullscreenShortcut: ['f', 'shift+f', 'ctrl+shift+f', 'alt+f'].includes(String(saved.fullscreenShortcut))
      ? saved.fullscreenShortcut as typeof defaults.fullscreenShortcut : 'f',
    activeMixId: typeof saved.activeMixId === 'string' ? saved.activeMixId.slice(0, 120) : null,
    atmosphereDrivesSoundscape: saved.atmosphereDrivesSoundscape !== false,
    features: sanitizeFeatures(saved.features),
  }
  let audioFile: PersonalAudioFile | null = null
  if (envelope.audioFile !== null && envelope.audioFile !== undefined) {
    const file = record(envelope.audioFile)
    if (typeof file.base64 !== 'string' || file.base64.length > Math.ceil(MAX_PERSONAL_AUDIO_BYTES / 3) * 4) {
      throw new Error('Invalid backup audio.')
    }
    const binary = atob(file.base64)
    if (!binary.length || binary.length > MAX_PERSONAL_AUDIO_BYTES) throw new Error('Invalid backup audio size.')
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    audioFile = { name: text(file.name, 'Personal audio', 200), blob: new Blob([bytes], { type: text(file.type, 'audio/mpeg') }) }
  }
  if (!audioFile) preferences.features.personalEnabled = false
  return { preferences, audioFile }
}

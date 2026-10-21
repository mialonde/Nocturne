import { describe, expect, it } from 'vitest'
import { createStarterSession } from '../config/sessions'
import type { SavedSession } from '../types'
import {
  SESSION_FILE_FORMAT,
  SESSION_FILE_VERSION,
  parseSessionFile,
  serializeSession,
} from './sessionFile'

describe('session file exchange', () => {
  it('preserves ambience profiles and frequency ladders on round trip', () => {
    const session = createStarterSession()
    session.segments[0].ambientProfile = 'rain'
    session.segments[0].ladder = { to: 6, carrierTo: 180 }
    session.segments[1].ambientProfile = 'user_mix_123'
    const restored = parseSessionFile(serializeSession(session))
    expect(restored.segments).toEqual(session.segments)
  })

  it('rejects unsupported versions instead of silently dropping future fields', () => {
    const envelope = JSON.parse(serializeSession(createStarterSession()))
    envelope.version = 2
    expect(() => parseSessionFile(JSON.stringify(envelope))).toThrow('version is not supported')
  })

  it('normalizes ladder targets and ignores malformed ladders', () => {
    const session = createStarterSession()
    session.segments[0].ladder = { to: 900, carrierTo: -10 }
    session.segments[1].ladder = { to: 'wrong' } as never
    const restored = parseSessionFile(serializeSession(session))
    expect(restored.segments[0].ladder).toEqual({ to: 40, carrierTo: 100 })
    expect(restored.segments[1].ladder).toBeNull()
  })
  it('wraps and restores a session with a new local identity', () => {
    const original = createStarterSession()
    const raw = serializeSession(original)
    const envelope = JSON.parse(raw) as {
      format: string
      version: number
      exportedAt: string
      session: SavedSession
    }
    expect(envelope.format).toBe(SESSION_FILE_FORMAT)
    expect(envelope.version).toBe(SESSION_FILE_VERSION)
    expect(Number.isNaN(Date.parse(envelope.exportedAt))).toBe(false)

    const imported = parseSessionFile(raw)
    expect(imported.id).not.toBe(original.id)
    expect(imported.name).toBe(original.name)
    expect(imported.note).toBe(original.note)
    expect(imported.segments).toHaveLength(original.segments.length)
    expect(imported.segments.map((segment) => segment.label)).toEqual(
      original.segments.map((segment) => segment.label),
    )
    expect(imported.segments[1]).toMatchObject({
      theme: 'ether',
      ambientProfile: 'ether',
      durationSec: 300,
    })
  })

  it('accepts a bare session object as well as the versioned envelope', () => {
    const original = createStarterSession()
    const imported = parseSessionFile(JSON.stringify(original))
    expect(imported.name).toBe(original.name)
    expect(imported.segments).toHaveLength(original.segments.length)
  })

  it('normalizes unsafe values and gives duplicate passage ids new identities', () => {
    const raw = JSON.stringify({
      name: '  Imported night  ',
      segments: [
        {
          id: 'duplicate',
          label: 'First',
          durationSec: 2,
          carrier: 900,
          beat: 0.1,
          theme: 'not-a-theme',
          ambientProfile: 'ether',
          ambientIntensity: 5,
          binaural: 'false',
          breathing: 1,
          fadeInSec: 100,
          fadeOutSec: -1,
          transitionSec: 500,
          breathPattern: { inhale: 0, hold: 99, exhale: 4, rest: -2 },
        },
        {
          id: 'duplicate',
          label: 'Second',
          durationSec: 120,
          theme: 'abyss',
        },
      ],
    })
    const imported = parseSessionFile(raw)
    expect(imported.name).toBe('Imported night')
    expect(imported.segments[0]).toMatchObject({
      durationSec: 10,
      carrier: 500,
      beat: 0.5,
      theme: 'dusk',
      ambientProfile: 'ether',
      ambientIntensity: 1,
      binaural: false,
      breathing: false,
      fadeInSec: 10,
      fadeOutSec: 0,
      transitionSec: 60,
      breathPattern: { inhale: 1, hold: 60, exhale: 4, rest: 0 },
    })
    expect(imported.segments[1]?.theme).toBe('abyss')
    expect(imported.segments[0]?.id).toBe('duplicate')
    expect(imported.segments[1]?.id).not.toBe('duplicate')
  })

  it('rejects malformed JSON and sessions without passages', () => {
    expect(() => parseSessionFile('{not json')).toThrow('not valid JSON')
    expect(() =>
      parseSessionFile(JSON.stringify({ format: SESSION_FILE_FORMAT, session: { name: 'Empty' } })),
    ).toThrow('at least one passage')
    expect(() => parseSessionFile(JSON.stringify({ segments: [] }))).toThrow(
      'at least one passage',
    )
  })

  it('rejects a file with too many passages', () => {
    const segments = Array.from({ length: 65 }, (_, index) => ({
      label: `Passage ${index}`,
      durationSec: 30,
    }))
    expect(() => parseSessionFile(JSON.stringify({ name: 'Too long', segments }))).toThrow(
      'too many passages',
    )
  })
})

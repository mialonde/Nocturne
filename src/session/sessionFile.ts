import { isThemeId } from '../config/themes'
import { DEFAULT_BREATH_PATTERN } from '../config/audio'
import type { BreathPattern, SavedSession, SessionSegment } from '../types'
import { createSegmentId, createSessionId, normalizeSegments } from '../config/sessions'
import { normalizeAutomation } from './automation'

export const SESSION_FILE_FORMAT = 'nocturne-session'
export const SESSION_FILE_VERSION = 1

export interface SessionFileEnvelope {
  format: typeof SESSION_FILE_FORMAT
  version: typeof SESSION_FILE_VERSION
  exportedAt: string
  session: SavedSession
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function safeString(value: unknown, fallback: string, maxLength = 120): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : fallback
}

function parseBreathPattern(value: unknown): BreathPattern {
  const record = asRecord(value)
  if (!record) return { ...DEFAULT_BREATH_PATTERN }
  return {
    inhale: Math.min(60, Math.max(1, finiteNumber(record.inhale, DEFAULT_BREATH_PATTERN.inhale))),
    hold: Math.min(60, Math.max(0, finiteNumber(record.hold, DEFAULT_BREATH_PATTERN.hold))),
    exhale: Math.min(60, Math.max(1, finiteNumber(record.exhale, DEFAULT_BREATH_PATTERN.exhale))),
    rest: Math.min(60, Math.max(0, finiteNumber(record.rest, DEFAULT_BREATH_PATTERN.rest))),
  }
}

function parseSegment(value: unknown, index: number, usedIds: Set<string>): SessionSegment {
  const record = asRecord(value)
  if (!record) {
    throw new Error(`Passage ${index + 1} is not a valid object.`)
  }
  let id = typeof record.id === 'string' && record.id.trim() ? record.id.trim().slice(0, 100) : ''
  if (!id || usedIds.has(id)) id = createSegmentId()
  usedIds.add(id)
  const theme = isThemeId(record.theme) ? record.theme : 'dusk'
  const ambientProfile = safeString(record.ambientProfile, theme, 120)
  const ladder = asRecord(record.ladder)
  return normalizeSegments([
    {
      id,
      label: safeString(record.label, `Passage ${index + 1}`, 80),
      durationSec: finiteNumber(record.durationSec, 180),
      carrier: finiteNumber(record.carrier, 200),
      beat: finiteNumber(record.beat, 8),
      theme,
      ambientProfile,
      ambientIntensity: finiteNumber(record.ambientIntensity, 0.5),
      binaural: record.binaural === true,
      breathing: record.breathing === true,
      breathPattern: parseBreathPattern(record.breathPattern),
      fadeInSec: finiteNumber(record.fadeInSec, 0),
      fadeOutSec: finiteNumber(record.fadeOutSec, 0),
      transitionSec: finiteNumber(record.transitionSec, 6),
      automation: normalizeAutomation(record.automation),
      ladder: ladder && typeof ladder.to === 'number' && Number.isFinite(ladder.to)
        ? {
            to: ladder.to,
            ...(typeof ladder.carrierTo === 'number' && Number.isFinite(ladder.carrierTo)
              ? { carrierTo: ladder.carrierTo } : {}),
          }
        : null,
    },
  ])[0]
}

export function serializeSession(session: SavedSession): string {
  const envelope: SessionFileEnvelope = {
    format: SESSION_FILE_FORMAT,
    version: SESSION_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    session,
  }
  return JSON.stringify(envelope, null, 2)
}

export function parseSessionFile(raw: string): SavedSession {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  const root = asRecord(parsed)
  if (!root) throw new Error('This file does not contain a session.')
  if (root.format === SESSION_FILE_FORMAT && root.version !== undefined && root.version !== SESSION_FILE_VERSION) {
    throw new Error('This session file version is not supported.')
  }
  const candidate = root.format === SESSION_FILE_FORMAT ? asRecord(root.session) : root
  if (!candidate) {
    throw new Error('This NOCTURNE file does not contain a readable session.')
  }
  const segmentsValue = candidate.segments
  if (!Array.isArray(segmentsValue) || segmentsValue.length === 0) {
    throw new Error('A session needs at least one passage.')
  }
  if (segmentsValue.length > 64) {
    throw new Error('This session has too many passages to import safely.')
  }
  const usedIds = new Set<string>()
  const segments = segmentsValue.map((segment, index) => parseSegment(segment, index, usedIds))
  const name = safeString(candidate.name, 'Imported session', 80)
  const now = Date.now()
  return {
    id: createSessionId(),
    name,
    note: safeString(candidate.note, 'Imported into NOCTURNE.', 400),
    createdAt: finiteNumber(candidate.createdAt, now),
    updatedAt: now,
    segments,
  }
}

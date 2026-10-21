import type { SavedSession, SessionSegment } from '../types'
import { DEFAULT_BREATH_PATTERN } from './audio'

let segmentSequence = 0

export function createSegmentId(): string {
  segmentSequence += 1
  return `seg-${Date.now().toString(36)}-${segmentSequence.toString(36)}`
}

export function createEmptySegment(overrides: Partial<SessionSegment> = {}): SessionSegment {
  return {
    id: createSegmentId(),
    label: 'New passage',
    durationSec: 180,
    carrier: 200,
    beat: 8,
    theme: 'dusk',
    ambientProfile: 'dusk',
    ambientIntensity: 0.55,
    binaural: true,
    breathing: false,
    breathPattern: { ...DEFAULT_BREATH_PATTERN },
    fadeInSec: 0,
    fadeOutSec: 0,
    transitionSec: 6,
    ...overrides,
  }
}

export function createSessionId(): string {
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function createStarterSession(): SavedSession {
  const now = Date.now()
  return {
    id: createSessionId(),
    name: 'Evening descent',
    note: 'A slow drift from bright attention into quiet. Adjust, reorder or remove any passage.',
    createdAt: now,
    updatedAt: now,
    segments: [
      createEmptySegment({
        label: 'Settling light',
        durationSec: 120,
        beat: 10,
        carrier: 220,
        theme: 'dusk',
        ambientProfile: 'dusk',
        ambientIntensity: 0.35,
        binaural: true,
        fadeInSec: 12,
        transitionSec: 8,
      }),
      createEmptySegment({
        label: 'Widening rings',
        durationSec: 300,
        beat: 8,
        carrier: 200,
        theme: 'ether',
        ambientProfile: 'ether',
        ambientIntensity: 0.5,
        binaural: true,
        transitionSec: 12,
      }),
      createEmptySegment({
        label: 'Darker water',
        durationSec: 300,
        beat: 6,
        carrier: 180,
        theme: 'abyss',
        ambientProfile: 'abyss',
        ambientIntensity: 0.32,
        binaural: true,
        transitionSec: 12,
      }),
      createEmptySegment({
        label: 'Return to stillness',
        durationSec: 120,
        beat: 4,
        carrier: 160,
        theme: 'dusk',
        ambientProfile: 'dusk',
        ambientIntensity: 0.16,
        binaural: true,
        fadeOutSec: 110,
        transitionSec: 8,
      }),
    ],
  }
}

export function totalSessionDuration(segments: SessionSegment[]): number {
  return segments.reduce((sum, segment) => sum + Math.max(1, segment.durationSec), 0) * 1000
}

export function findSegmentAtTime(
  segments: SessionSegment[],
  elapsedMs: number,
): { index: number; segmentStartMs: number; segmentElapsedMs: number; elapsedMs: number } | null {
  let cursor = 0
  const elapsed = Math.max(0, elapsedMs)
  for (let index = 0; index < segments.length; index += 1) {
    const durationMs = Math.max(1, segments[index].durationSec) * 1000
    if (elapsed < cursor + durationMs) {
      return {
        index,
        segmentStartMs: cursor,
        segmentElapsedMs: elapsed - cursor,
        elapsedMs: elapsed,
      }
    }
    cursor += durationMs
  }
  return null
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

export function normalizeSegments(segments: SessionSegment[]): SessionSegment[] {
  return segments.map((segment) => {
    const durationSec = Math.max(10, Math.min(60 * 60, Math.round(finiteOr(segment.durationSec, 180))))
    return {
      ...segment,
      durationSec,
      carrier: Math.min(500, Math.max(100, finiteOr(segment.carrier, 200))),
      beat: Math.min(40, Math.max(0.5, finiteOr(segment.beat, 8))),
      ambientIntensity: Math.min(1, Math.max(0, finiteOr(segment.ambientIntensity, 0.5))),
      fadeInSec: Math.max(0, Math.min(durationSec, finiteOr(segment.fadeInSec, 0))),
      fadeOutSec: Math.max(0, Math.min(durationSec, finiteOr(segment.fadeOutSec, 0))),
      transitionSec: Math.max(0, Math.min(60, finiteOr(segment.transitionSec, 6))),
    }
  })
}

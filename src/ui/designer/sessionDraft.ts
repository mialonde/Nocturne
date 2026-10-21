import { createEmptySegment, createSessionId } from '../../config/sessions'
import type { SavedSession } from '../../types'

export function cloneSessionDraft(session: SavedSession): SavedSession {
  return {
    ...session,
    segments: session.segments.map((segment) => ({
      ...segment,
      breathPattern: { ...segment.breathPattern },
    })),
  }
}

export function createSessionDraft(name = 'Untitled descent'): SavedSession {
  const now = Date.now()
  return {
    id: createSessionId(),
    name,
    note: 'A new sequence of light, tone and quiet.',
    createdAt: now,
    updatedAt: now,
    segments: [
      createEmptySegment({
        label: 'First light',
        durationSec: 300,
        fadeInSec: 15,
        transitionSec: 8,
      }),
    ],
  }
}

export function slugifySessionName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'nocturne-session'
}

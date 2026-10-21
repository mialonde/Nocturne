import type { SessionSegment } from '../types'

/**
 * The envelope is the product of the passage's fade-in and fade-out
 * boundaries, clamped to 0..1. It does not lower the middle of a passage.
 */
export function segmentEnvelope(
  segmentElapsedSeconds: number,
  segment: Pick<SessionSegment, 'durationSec' | 'fadeInSec' | 'fadeOutSec'>,
): number {
  const local = Math.max(0, segmentElapsedSeconds)
  const duration = Math.max(1, segment.durationSec)
  let gain = 1
  if (segment.fadeInSec > 0) {
    gain = Math.min(gain, local / segment.fadeInSec)
  }
  if (segment.fadeOutSec > 0) {
    gain = Math.min(gain, Math.max(0, (duration - local) / segment.fadeOutSec))
  }
  return Math.min(1, Math.max(0, gain))
}

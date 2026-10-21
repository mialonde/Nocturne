import { describe, expect, it } from 'vitest'
import {
  createEmptySegment,
  findSegmentAtTime,
  normalizeSegments,
  totalSessionDuration,
} from '../config/sessions'
import { segmentEnvelope } from './envelope'

describe('segment envelope', () => {
  it('stays fully open without fades', () => {
    expect(segmentEnvelope(0, { durationSec: 60, fadeInSec: 0, fadeOutSec: 0 })).toBe(1)
    expect(segmentEnvelope(59, { durationSec: 60, fadeInSec: 0, fadeOutSec: 0 })).toBe(1)
  })

  it('rises linearly through a fade-in', () => {
    const segment = { durationSec: 60, fadeInSec: 10, fadeOutSec: 0 }
    expect(segmentEnvelope(0, segment)).toBe(0)
    expect(segmentEnvelope(5, segment)).toBe(0.5)
    expect(segmentEnvelope(10, segment)).toBe(1)
    expect(segmentEnvelope(20, segment)).toBe(1)
  })

  it('falls linearly through a fade-out and closes at the boundary', () => {
    const segment = { durationSec: 60, fadeInSec: 0, fadeOutSec: 10 }
    expect(segmentEnvelope(49.9, segment)).toBe(1)
    expect(segmentEnvelope(55, segment)).toBeCloseTo(0.5)
    expect(segmentEnvelope(60, segment)).toBe(0)
    expect(segmentEnvelope(70, segment)).toBe(0)
  })

  it('uses the quieter of overlapping fades and clamps out-of-range time', () => {
    const segment = { durationSec: 10, fadeInSec: 20, fadeOutSec: 20 }
    expect(segmentEnvelope(5, segment)).toBeCloseTo(0.25, 8)
    expect(segmentEnvelope(-5, segment)).toBe(0)
    expect(segmentEnvelope(100, segment)).toBe(0)
  })
})

describe('session timeline', () => {
  const segments = [
    createEmptySegment({ durationSec: 10 }),
    createEmptySegment({ durationSec: 20 }),
  ]

  it('sums passage durations in milliseconds', () => {
    expect(totalSessionDuration(segments)).toBe(30_000)
  })

  it('finds the active passage at its exact boundaries', () => {
    expect(findSegmentAtTime(segments, 0)).toMatchObject({
      index: 0,
      segmentElapsedMs: 0,
    })
    expect(findSegmentAtTime(segments, 9_999)).toMatchObject({
      index: 0,
      segmentElapsedMs: 9_999,
    })
    expect(findSegmentAtTime(segments, 10_000)).toMatchObject({
      index: 1,
      segmentElapsedMs: 0,
    })
    expect(findSegmentAtTime(segments, 29_999)).toMatchObject({
      index: 1,
      segmentElapsedMs: 19_999,
    })
    expect(findSegmentAtTime(segments, 30_000)).toBeNull()
  })

  it('normalizes unsafe segment values and clamps fades to duration', () => {
    const [normalized] = normalizeSegments([
      createEmptySegment({
        durationSec: 5,
        carrier: 50,
        beat: 0.1,
        ambientIntensity: 2,
        fadeInSec: 100,
        fadeOutSec: -4,
        transitionSec: 100,
      }),
    ])
    expect(normalized).toMatchObject({
      durationSec: 10,
      carrier: 100,
      beat: 0.5,
      ambientIntensity: 1,
      fadeInSec: 10,
      fadeOutSec: 0,
      transitionSec: 60,
    })
  })

  it('falls back when a numeric field is not finite', () => {
    const [normalized] = normalizeSegments([
      createEmptySegment({
        durationSec: Number.NaN,
        carrier: Number.POSITIVE_INFINITY,
        beat: Number.NaN,
      }),
    ])
    expect(normalized).toMatchObject({
      durationSec: 180,
      carrier: 200,
      beat: 8,
    })
  })
})

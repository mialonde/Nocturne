import { afterEach, describe, expect, it, vi } from 'vitest'
import { chooseSupportedMimeType, describeMimeType } from './RecordingEngine'

function stubMediaRecorder(isTypeSupported?: (mimeType: string) => boolean) {
  vi.stubGlobal(
    'MediaRecorder',
    isTypeSupported ? { isTypeSupported } : {},
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('recording format selection', () => {
  it('prefers VP9 with Opus when both are available', () => {
    stubMediaRecorder((mimeType) =>
      [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ].includes(mimeType),
    )
    expect(chooseSupportedMimeType(true)).toBe('video/webm;codecs=vp9,opus')
  })

  it('falls back to VP8 with Opus', () => {
    stubMediaRecorder((mimeType) =>
      ['video/webm;codecs=vp8,opus', 'video/webm'].includes(mimeType),
    )
    expect(chooseSupportedMimeType(true)).toBe('video/webm;codecs=vp8,opus')
  })

  it('falls back to a plain WebM container', () => {
    stubMediaRecorder((mimeType) => mimeType === 'video/webm')
    expect(chooseSupportedMimeType(true)).toBe('video/webm')
  })

  it('uses video-only candidates when audio is disabled', () => {
    stubMediaRecorder((mimeType) =>
      ['video/webm;codecs=vp9', 'video/webm;codecs=vp9,opus'].includes(mimeType),
    )
    expect(chooseSupportedMimeType(false)).toBe('video/webm;codecs=vp9')
  })

  it('reports null when no WebM candidate is supported', () => {
    stubMediaRecorder(() => false)
    expect(chooseSupportedMimeType(true)).toBeNull()
    expect(chooseSupportedMimeType(false)).toBeNull()
  })

  it('reports null when MediaRecorder is unavailable or has no probe', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(chooseSupportedMimeType(true)).toBeNull()

    stubMediaRecorder()
    expect(chooseSupportedMimeType(true)).toBeNull()
  })

  it('describes the chosen codecs without claiming MP4', () => {
    expect(describeMimeType('video/webm;codecs=vp9,opus')).toBe('WebM · VP9 · Opus stereo')
    expect(describeMimeType('video/webm;codecs=vp8,opus')).toBe('WebM · VP8 · Opus stereo')
    expect(describeMimeType('video/webm;codecs=vp9')).toBe('WebM · VP9')
    expect(describeMimeType('video/webm')).toBe('WebM · WebM')
    expect(describeMimeType('video/mp4')).toBe('video/mp4')
  })
})

import { describe, expect, it } from 'vitest'
import { stampWebmDuration } from './webmDuration'

const EBML_HEADER = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x80])
const UNKNOWN_SIZE = new Uint8Array([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])

function segmentUnknown(): Uint8Array {
  return new Uint8Array([0x18, 0x53, 0x80, 0x67, ...UNKNOWN_SIZE])
}

function timecodeScale(): Uint8Array {
  return new Uint8Array([0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40])
}

function info(children: Uint8Array[], sizeLength = 1): Uint8Array {
  const length = children.reduce((sum, child) => sum + child.length, 0)
  if (length > 126) throw new Error('test helper only supports a one-byte Info size')
  const output = new Uint8Array(4 + sizeLength + length)
  output.set([0x15, 0x49, 0xa9, 0x66], 0)
  output[4] = 0x80 | length
  let offset = 5
  for (const child of children) {
    output.set(child, offset)
    offset += child.length
  }
  return output
}

function cluster(): Uint8Array {
  return new Uint8Array([0x1f, 0x43, 0xb6, 0x75, ...UNKNOWN_SIZE, 9, 8, 7, 6])
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function readDuration(buffer: Uint8Array): number | null {
  for (let index = 0; index < buffer.length - 10; index += 1) {
    if (buffer[index] === 0x44 && buffer[index + 1] === 0x89 && buffer[index + 2] === 0x88) {
      return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getFloat64(index + 3, false)
    }
  }
  return null
}

describe('stampWebmDuration', () => {
  it('adds an EBML duration without making the streaming segment finite', () => {
    const original = concat(EBML_HEADER, segmentUnknown(), info([timecodeScale()]), cluster())
    const stamped = stampWebmDuration(original, 5432)
    expect(stamped).not.toBeNull()
    if (!stamped) return

    expect(stamped.length).toBe(original.length + 11)
    expect(readDuration(stamped)).toBeCloseTo(5432, 6)
    // The Segment ID and its unknown-size marker must be preserved verbatim.
    expect(stamped.slice(5, 17)).toEqual(concat(segmentUnknown()))
    // Media payload after Info is untouched.
    expect(stamped.slice(stamped.length - 16)).toEqual(cluster())
  })

  it('replaces a zero duration instead of duplicating it', () => {
    const zeroDuration = new Uint8Array([0x44, 0x89, 0x88, 0, 0, 0, 0, 0, 0, 0, 0])
    const original = concat(
      EBML_HEADER,
      segmentUnknown(),
      info([timecodeScale(), zeroDuration]),
      cluster(),
    )
    const stamped = stampWebmDuration(original, 2000)
    expect(stamped).not.toBeNull()
    if (!stamped) return
    expect(stamped.length).toBe(original.length)
    expect(readDuration(stamped)).toBeCloseTo(2000, 6)
  })

  it('uses the file timecode scale', () => {
    const microsecondScale = new Uint8Array([0x2a, 0xd7, 0xb1, 0x83, 0x00, 0x03, 0xe8])
    const original = concat(EBML_HEADER, segmentUnknown(), info([microsecondScale]), cluster())
    const stamped = stampWebmDuration(original, 1000)
    expect(stamped).not.toBeNull()
    if (!stamped) return
    expect(readDuration(stamped)).toBeCloseTo(1_000_000, 3)
  })

  it('leaves finite or malformed containers untouched', () => {
    const finiteSegment = new Uint8Array([0x18, 0x53, 0x80, 0x67, 0x84, 1, 2, 3, 4])
    expect(stampWebmDuration(concat(EBML_HEADER, finiteSegment), 1000)).toBeNull()
    expect(stampWebmDuration(new Uint8Array([1, 2, 3]), 1000)).toBeNull()
    expect(stampWebmDuration(concat(EBML_HEADER, segmentUnknown()), 1000)).toBeNull()
    expect(stampWebmDuration(concat(EBML_HEADER, segmentUnknown(), info([timecodeScale()])), 0)).toBeNull()
  })
})

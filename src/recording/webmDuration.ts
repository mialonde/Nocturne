/**
 * MediaRecorder writes a live WebM: the Segment has an unknown size and the
 * Info element has no Duration. Chromium can often play such a file, but some
 * players report an infinite duration and refuse to seek. This module appends
 * the missing EBML Duration without remuxing the media or changing the
 * unknown-sized Segment/Cluster structure.
 *
 * Only the standard streaming layout emitted by MediaRecorder is handled. If
 * the input is not that shape, the original blob is returned untouched.
 */

const ID_SEGMENT = 0x18538067
const ID_INFO = 0x1549a966
const ID_TIMECODE_SCALE = 0x2ad7b1
const ID_DURATION = 0x4489

interface ElementHeader {
  id: number
  idLength: number
  sizeLength: number
  dataStart: number
  dataEnd: number | null
  unknownSize: boolean
  sizeStart: number
}

function readId(buffer: Uint8Array, offset: number): { value: number; length: number } | null {
  if (offset >= buffer.length) return null
  const first = buffer[offset]
  let length = 1
  let mask = 0x80
  while (length <= 4 && (first & mask) === 0) {
    length += 1
    mask >>= 1
  }
  if (length > 4 || offset + length > buffer.length) return null
  let value = 0
  for (let index = 0; index < length; index += 1) {
    value = value * 256 + buffer[offset + index]
  }
  return { value, length }
}

function readSize(
  buffer: Uint8Array,
  offset: number,
): { value: number | null; length: number; allOnes: boolean } | null {
  if (offset >= buffer.length) return null
  const first = buffer[offset]
  let length = 1
  let mask = 0x80
  while (length <= 8 && (first & mask) === 0) {
    length += 1
    mask >>= 1
  }
  if (length > 8 || offset + length > buffer.length) return null
  let value = first & (mask - 1)
  let allOnes = value === mask - 1
  for (let index = 1; index < length; index += 1) {
    const byte = buffer[offset + index]
    value = value * 256 + byte
    if (byte !== 0xff) allOnes = false
  }
  return { value: allOnes ? null : value, length, allOnes }
}

function readHeader(buffer: Uint8Array, offset: number, totalEnd = buffer.length): ElementHeader | null {
  const id = readId(buffer, offset)
  if (!id) return null
  const size = readSize(buffer, offset + id.length)
  if (!size) return null
  const dataStart = offset + id.length + size.length
  const dataEnd = size.value === null ? null : dataStart + size.value
  if (dataEnd !== null && dataEnd > totalEnd) return null
  return {
    id: id.value,
    idLength: id.length,
    sizeLength: size.length,
    dataStart,
    dataEnd,
    unknownSize: size.value === null,
    sizeStart: offset + id.length,
  }
}

function findChild(buffer: Uint8Array, start: number, end: number, wanted: number): ElementHeader | null {
  let offset = start
  while (offset < end) {
    const header = readHeader(buffer, offset, end)
    if (!header) return null
    if (header.id === wanted) return header
    if (header.unknownSize) return null
    offset = header.dataEnd ?? offset + 1
  }
  return null
}

function encodeSize(value: number): Uint8Array {
  let length = 1
  while (length <= 8 && value >= 2 ** (7 * length) - 1) length += 1
  const bytes = new Uint8Array(length)
  let remaining = value
  for (let index = length - 1; index >= 0; index -= 1) {
    bytes[index] = remaining & 0xff
    remaining = Math.floor(remaining / 256)
  }
  bytes[0] |= 0x80 >> (length - 1)
  return bytes
}

function readUnsigned(buffer: Uint8Array, header: ElementHeader): number {
  let value = 0
  for (let index = header.dataStart; index < (header.dataEnd ?? header.dataStart); index += 1) {
    value = value * 256 + buffer[index]
  }
  return value
}

function durationElement(durationMs: number): Uint8Array {
  const bytes = new Uint8Array(11)
  bytes[0] = 0x44
  bytes[1] = 0x89
  bytes[2] = 0x88 // eight-byte payload
  new DataView(bytes.buffer).setFloat64(3, durationMs, false)
  return bytes
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

export function stampWebmDuration(buffer: Uint8Array, durationMs: number): Uint8Array | null {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null

  const ebml = readHeader(buffer, 0)
  if (!ebml || ebml.id !== 0x1a45dfa3 || ebml.dataEnd === null) return null

  const segment = findChild(buffer, ebml.dataEnd, buffer.length, ID_SEGMENT)
  if (!segment || !segment.unknownSize) {
    // A finite Segment needs its size, SeekHead and Cue offsets rewritten.
    // MediaRecorder does not produce that layout, so leave it untouched.
    return null
  }

  const info = findChild(buffer, segment.dataStart, buffer.length, ID_INFO)
  if (!info || info.dataEnd === null) return null

  const scaleElement = findChild(buffer, info.dataStart, info.dataEnd, ID_TIMECODE_SCALE)
  if (!scaleElement) return null
  const timecodeScaleNs = readUnsigned(buffer, scaleElement)
  if (timecodeScaleNs <= 0) return null
  const durationInTimecodes = (durationMs * 1_000_000) / timecodeScaleNs

  // Remove any existing (usually zero or stale) Duration and append a final one.
  const children: Uint8Array[] = []
  let offset = info.dataStart
  while (offset < info.dataEnd) {
    const child = readHeader(buffer, offset, info.dataEnd)
    if (!child) return null
    if (child.unknownSize) return null
    const childEnd = child.dataEnd ?? offset + 1
    if (child.id !== ID_DURATION) {
      children.push(buffer.subarray(offset, childEnd))
    }
    offset = childEnd
  }
  children.push(durationElement(durationInTimecodes))
  const nextInfoData = concat(children)
  const nextInfoSize = encodeSize(nextInfoData.length)
  const infoId = buffer.subarray(info.sizeStart - info.idLength, info.sizeStart)

  const prefix = buffer.subarray(0, info.sizeStart - info.idLength)
  const suffix = buffer.subarray(info.dataEnd)
  return concat([prefix, infoId, nextInfoSize, nextInfoData, suffix])
}

export async function stampWebmDurationBlob(blob: Blob, durationMs: number): Promise<Blob> {
  try {
    const buffer = new Uint8Array(await blob.arrayBuffer())
    const stamped = stampWebmDuration(buffer, durationMs)
    if (!stamped) return blob
    const bytes = stamped.buffer.slice(
      stamped.byteOffset,
      stamped.byteOffset + stamped.byteLength,
    ) as ArrayBuffer
    return new Blob([bytes], { type: blob.type || 'video/webm' })
  } catch {
    return blob
  }
}

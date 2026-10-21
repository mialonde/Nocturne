/**
 * Writes an AudioBuffer as a 16 bit PCM WAV file.
 *
 * A plain uncompressed file opens in every player and every audio editor,
 * which matters when the recording is meant to be used outside the app.
 */
function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index))
  }
}

export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = Math.max(1, buffer.numberOfChannels)
  const frames = buffer.length
  const sampleRate = buffer.sampleRate
  const bytesPerSample = 2
  const blockAlign = channels * bytesPerSample
  const dataSize = frames * blockAlign

  const output = new ArrayBuffer(44 + dataSize)
  const view = new DataView(output)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  const channelData: Float32Array[] = []
  for (let channel = 0; channel < channels; channel += 1) {
    channelData.push(buffer.getChannelData(channel))
  }

  let offset = 44
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const raw = channelData[channel][frame] ?? 0
      const clamped = raw < -1 ? -1 : raw > 1 ? 1 : raw
      const value = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff)
      view.setInt16(offset, value, true)
      offset += 2
    }
  }

  return new Blob([output], { type: 'audio/wav' })
}

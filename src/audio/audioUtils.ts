export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20)
}

export function safeSetTarget(
  param: AudioParam,
  value: number,
  contextTime: number,
  rampSeconds = 0.08,
): void {
  const safeValue = Number.isFinite(value) ? value : 0
  const safeRamp = Math.max(0.01, Math.min(30, rampSeconds))
  try {
    param.cancelScheduledValues(contextTime)
    param.setValueAtTime(param.value, contextTime)
    param.setTargetAtTime(safeValue, contextTime, safeRamp / 3)
  } catch {
    param.value = safeValue
  }
}

export function safeRamp(
  param: AudioParam,
  value: number,
  contextTime: number,
  rampSeconds = 0.08,
): void {
  const safeValue = Number.isFinite(value) ? value : 0
  try {
    param.cancelScheduledValues(contextTime)
    param.setValueAtTime(param.value, contextTime)
    param.linearRampToValueAtTime(safeValue, contextTime + Math.max(0.01, rampSeconds))
  } catch {
    param.value = safeValue
  }
}

/**
 * Creates a smooth, faded stereo impulse response. Noise alone can sound
 * metallic, so early reflections are shaped with a soft cosine taper and a
 * long diffuse tail.
 */
export function createImpulseResponse(
  context: BaseAudioContext,
  seconds = 4.2,
  decay = 2.8,
): AudioBuffer {
  const rate = context.sampleRate
  const length = Math.max(1, Math.floor(rate * seconds))
  const impulse = context.createBuffer(2, length, rate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel)
    let last = 0
    for (let i = 0; i < length; i += 1) {
      const t = i / length
      const envelope = Math.pow(1 - t, decay) * Math.exp(-t * 1.2)
      const white = Math.random() * 2 - 1
      // A tiny amount of smoothing takes the hard edge off the noise.
      last = last * 0.82 + white * 0.18
      data[i] = last * envelope * 0.75
    }
    // A few soft early reflections give the tail a room-like character.
    const reflections = [0.071, 0.113, 0.181, 0.263, 0.37]
    reflections.forEach((offset, index) => {
      const sample = Math.floor(offset * rate) + (channel === 1 ? 67 : 0)
      if (sample < length) {
        data[sample] += (index % 2 === 0 ? 0.22 : -0.16) * (1 - index * 0.1)
      }
    })
  }
  return impulse
}

/**
 * Stereo pink-brown noise. The two channels use separate seeds, so the wind
 * bed has width without any periodic loops or harsh transients.
 */
export function createNoiseBuffer(context: BaseAudioContext, seconds = 3.5): AudioBuffer {
  const rate = context.sampleRate
  const length = Math.max(1, Math.floor(rate * seconds))
  const buffer = context.createBuffer(2, length, rate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    let b0 = 0
    let b1 = 0
    let b2 = 0
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1
      b0 = 0.99765 * b0 + white * 0.099
      b1 = 0.963 * b1 + white * 0.2965
      b2 = 0.57 * b2 + white * 1.0526
      data[i] = clamp((b0 + b1 + b2) * 0.18, -1, 1)
    }
    // Crossfade the loop boundary so there is no click.
    const fade = Math.min(4096, Math.floor(length * 0.08))
    for (let i = 0; i < fade; i += 1) {
      const mix = i / fade
      data[length - fade + i] = data[length - fade + i] * (1 - mix) + data[i] * mix
    }
  }
  return buffer
}

export function createWhiteNoiseBuffer(context: BaseAudioContext, seconds = 3): AudioBuffer {
  const rate = context.sampleRate
  const length = Math.max(1, Math.floor(rate * seconds))
  const buffer = context.createBuffer(2, length, rate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.4
    }
    const fade = Math.min(2048, Math.floor(length * 0.05))
    for (let i = 0; i < fade; i += 1) {
      const mix = i / fade
      data[length - fade + i] = data[length - fade + i] * (1 - mix) + data[i] * mix
    }
  }
  return buffer
}

export function createBrownNoiseBuffer(context: BaseAudioContext, seconds = 4): AudioBuffer {
  const rate = context.sampleRate
  const length = Math.max(1, Math.floor(rate * seconds))
  const buffer = context.createBuffer(2, length, rate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    let last = 0
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = clamp(last * 3.5, -1, 1)
    }
    const fade = Math.min(4096, Math.floor(length * 0.08))
    for (let i = 0; i < fade; i += 1) {
      const mix = i / fade
      data[length - fade + i] = data[length - fade + i] * (1 - mix) + data[i] * mix
    }
  }
  return buffer
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

import type { AmbienceSoundId } from '../config/ambience'
/** Keyed sequence independent of track iteration order. Only mix levels vary. */
export function livingFactors(seed: number, event: number, variation: number,
  ids: AmbienceSoundId[]): Partial<Record<AmbienceSoundId, number>> {
  const result: Partial<Record<AmbienceSoundId, number>> = {}
  for (const id of ids) {
    let hash = (seed ^ Math.imul(event + 1, 0x9e3779b9)) >>> 0
    for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0
    const random = (hash ^ (hash >>> 16)) >>> 0
    result[id] = 1 + (random / 0xffffffff * 2 - 1) * Math.max(0, Math.min(0.8, variation))
  }
  return result
}

import { isGuidanceProfile, type GuidanceProfileId } from './guidance'
export interface FeatureSettings {
  audioOnly: boolean
  keepAwake: boolean
  voiceEnabled: boolean
  voiceProfile: GuidanceProfileId
  voiceVolume: number
  voiceEverySec: number
  personalEnabled: boolean
  personalVolume: number
  personalPan: number
  livingEnabled: boolean
  livingSeed: number
  livingVariation: number
  livingEverySec: number
}

export const DEFAULT_FEATURE_SETTINGS: FeatureSettings = {
  audioOnly: false, keepAwake: true,
  voiceEnabled: false, voiceProfile: 'meditation', voiceVolume: 0.5, voiceEverySec: 90,
  personalEnabled: false, personalVolume: 0.5, personalPan: 0,
  livingEnabled: false, livingSeed: 42, livingVariation: 0.3, livingEverySec: 45,
}

export function sanitizeFeatures(value: unknown): FeatureSettings {
  const result = { ...DEFAULT_FEATURE_SETTINGS }
  if (!value || typeof value !== 'object') return result
  const source = value as Record<string, unknown>
  if (isGuidanceProfile(source.voiceProfile)) result.voiceProfile = source.voiceProfile
  for (const key of ['audioOnly', 'keepAwake', 'voiceEnabled', 'personalEnabled', 'livingEnabled'] as const) {
    if (typeof source[key] === 'boolean') result[key] = source[key]
  }
  const ranges = {
    voiceVolume: [0, 1], voiceEverySec: [30, 600], personalVolume: [0, 1],
    personalPan: [-1, 1], livingSeed: [1, 2147483647], livingVariation: [0, 0.8], livingEverySec: [10, 180],
  } as const
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
    const number = source[key]
    if (typeof number === 'number' && Number.isFinite(number)) {
      result[key] = Math.max(ranges[key][0], Math.min(ranges[key][1], number))
    }
  }
  result.livingSeed = Math.round(result.livingSeed)
  return result
}

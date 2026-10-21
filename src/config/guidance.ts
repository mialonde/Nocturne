import scripts from '../../scripts/sources/guidance-scripts.json'
export type GuidanceProfileId = keyof typeof scripts
export const GUIDANCE_PROFILES = scripts
export const GUIDANCE_PROFILE_IDS = Object.keys(scripts) as GuidanceProfileId[]
export function isGuidanceProfile(value: unknown): value is GuidanceProfileId {
  return typeof value === 'string' && Object.hasOwn(scripts, value)
}
export function guidanceClipPath(profile: GuidanceProfileId, clip: string): string {
  return `/audio/guidance/${profile}/${clip}.mp3`
}
export async function guidanceAvailability(signal?: AbortSignal): Promise<Record<GuidanceProfileId, boolean>> {
  const response = await fetch('/audio/guidance/manifest.json', { signal })
  if (!response.ok) throw new Error('Guidance manifest could not load.')
  const manifest = await response.json() as { version?: number; profiles?: Record<string, unknown> }
  if (manifest.version !== 1) throw new Error('Unsupported guidance manifest.')
  return Object.fromEntries(GUIDANCE_PROFILE_IDS.map((id) => [id, manifest.profiles?.[id] === true])) as Record<GuidanceProfileId, boolean>
}

import type { PassageAutomation } from '../types'
export interface VisualAutomationFrame { intensity: number; bloom: number; cameraMotion: number }
export function normalizeAutomation(value: unknown): PassageAutomation | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const source = value as Record<string, unknown>
  const keys = ['visualIntensityTo', 'bloomTo', 'ambientTo', 'cameraMotionTo'] as const
  if (keys.some((key) => typeof source[key] !== 'number' || !Number.isFinite(source[key]))) return undefined
  return {
    visualIntensityTo: Math.max(0.2, Math.min(1.4, source.visualIntensityTo as number)),
    bloomTo: Math.max(0, Math.min(1.5, source.bloomTo as number)),
    ambientTo: Math.max(0, Math.min(1, source.ambientTo as number)),
    cameraMotionTo: Math.max(0, Math.min(2, source.cameraMotionTo as number)),
  }
}
export function automationFrame(start: VisualAutomationFrame, target: PassageAutomation, progress: number): VisualAutomationFrame {
  const t = Math.max(0, Math.min(1, progress))
  const lerp = (from: number, to: number) => from + (to - from) * t
  return { intensity: lerp(start.intensity, target.visualIntensityTo), bloom: lerp(start.bloom, target.bloomTo),
    cameraMotion: lerp(start.cameraMotion, target.cameraMotionTo) }
}

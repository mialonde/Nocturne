import { useSyncExternalStore } from 'react'
import type { AudioExporter, AudioExportSnapshot } from '../../recording/AudioExporter'

export function useAudioExportSnapshot(exporter: AudioExporter): AudioExportSnapshot {
  return useSyncExternalStore(exporter.subscribe, exporter.getSnapshot, exporter.getSnapshot)
}

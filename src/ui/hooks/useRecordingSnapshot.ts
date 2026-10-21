import { useSyncExternalStore } from 'react'
import type { RecordingEngine, RecordingSnapshot } from '../../recording/RecordingEngine'

export function useRecordingSnapshot(engine: RecordingEngine): RecordingSnapshot {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
}

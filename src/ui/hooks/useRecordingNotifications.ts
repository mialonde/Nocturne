import { useEffect, useRef } from 'react'
import type { RecordingEngine } from '../../recording/RecordingEngine'
import { useNocturneStore } from '../../store/useNocturneStore'
import { formatBytes, formatDurationMs } from '../format'
import { useRecordingSnapshot } from './useRecordingSnapshot'

export function useRecordingNotifications(engine: RecordingEngine): void {
  const snapshot = useRecordingSnapshot(engine)
  const previousPhase = useRef(snapshot.phase)
  const showToast = useNocturneStore((state) => state.showToast)

  useEffect(() => {
    const previous = previousPhase.current
    if (snapshot.phase === 'ready' && previous !== 'ready' && snapshot.result) {
      showToast(
        `Recording ready · ${formatDurationMs(snapshot.result.durationMs)} · ${formatBytes(
          snapshot.result.bytes,
        )}. Preview it in Studio.`,
        'quiet',
      )
    }
    if (snapshot.phase === 'error' && previous !== 'error' && snapshot.error) {
      showToast(snapshot.error, 'error')
    }
    previousPhase.current = snapshot.phase
  }, [showToast, snapshot.phase, snapshot.result, snapshot.error])
}

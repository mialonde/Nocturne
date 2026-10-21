import { useNocturneRuntime } from '../../runtime/NocturneRuntime'
import { useAudioExportSnapshot } from '../hooks/useAudioExportSnapshot'
import { useRecordingSnapshot } from '../hooks/useRecordingSnapshot'

export function useCaptureBusy(): boolean {
  const runtime = useNocturneRuntime()
  const video = useRecordingSnapshot(runtime.recording).phase
  const audio = useAudioExportSnapshot(runtime.audioExporter).phase
  return ['preparing', 'recording', 'paused', 'processing'].includes(video) ||
    audio === 'recording' || audio === 'processing'
}

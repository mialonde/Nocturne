import { CircleStop, LoaderCircle, Pause, Play } from 'lucide-react'
import { useNocturneRuntime } from '../runtime/NocturneRuntime'
import { useNocturneStore } from '../store/useNocturneStore'
import { useRecordingSnapshot } from './hooks/useRecordingSnapshot'
import { formatDurationMs } from './format'

export function RecordingHud({ compact = false }: { compact?: boolean }) {
  const runtime = useNocturneRuntime()
  const recording = useRecordingSnapshot(runtime.recording)
  const cleanCapture = useNocturneStore((state) => state.recording.cleanCapture)
  if (
    recording.phase !== 'recording' &&
    recording.phase !== 'paused' &&
    recording.phase !== 'processing'
  ) {
    return null
  }
  const paused = recording.phase === 'paused'
  const processing = recording.phase === 'processing'

  return (
    <section
      className={`recording-hud ${compact ? 'is-compact' : ''} ${paused ? 'is-paused' : ''}`.trim()}
      aria-label="Recording status"
      aria-live="polite"
    >
      <span className={`recording-hud__dot ${processing ? 'is-processing' : ''}`.trim()} aria-hidden="true" />
      <div className="recording-hud__copy">
        <span className="recording-hud__eyebrow">
          {processing ? 'Sealing file' : paused ? 'Recording paused' : 'Recording'}
        </span>
        <strong>
          {processing ? 'Preparing preview…' : formatDurationMs(recording.elapsedMs)}
        </strong>
      </div>
      {!compact ? (
        <>
          <span className="recording-hud__format">
            {recording.width}×{recording.height} · {recording.fps} fps
            {!cleanCapture ? ' · stamp' : ''}
          </span>
          {!processing ? (
            <div className="recording-hud__controls">
              <button
                type="button"
                className="recording-hud__button"
                aria-label={paused ? 'Resume recording' : 'Pause recording'}
                title={paused ? 'Resume recording' : 'Pause recording'}
                disabled={!recording.pausedSupported}
                onClick={() => {
                  if (paused) runtime.recording.resume()
                  else runtime.recording.pause()
                }}
              >
                {paused ? (
                  <Play size={13} strokeWidth={1.6} aria-hidden="true" />
                ) : (
                  <Pause size={13} strokeWidth={1.6} aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                className="recording-hud__button recording-hud__button--stop"
                aria-label="Stop recording"
                title="Stop recording"
                onClick={() => runtime.recording.stop()}
              >
                <CircleStop size={14} strokeWidth={1.6} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <LoaderCircle className="spin recording-hud__spinner" size={16} strokeWidth={1.4} aria-hidden="true" />
          )}
        </>
      ) : (
        <div className="recording-hud__mini-actions">
          {!processing ? (
            <button
              type="button"
              className="recording-hud__button"
              aria-label="Stop recording"
              onClick={() => runtime.recording.stop()}
            >
              <CircleStop size={14} strokeWidth={1.6} aria-hidden="true" />
            </button>
          ) : (
            <LoaderCircle className="spin" size={14} strokeWidth={1.4} aria-hidden="true" />
          )}
        </div>
      )}
    </section>
  )
}

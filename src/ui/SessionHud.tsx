import { Pause, Play, Square } from 'lucide-react'
import { useNocturneRuntime } from '../runtime/NocturneRuntime'
import { useNocturneStore } from '../store/useNocturneStore'
import { formatDurationMs } from './format'

export function SessionHud() {
  const runtime = useNocturneRuntime()
  const playback = useNocturneStore((state) => state.sessionPlayback)
  if (playback.status === 'idle') return null
  const progress = playback.totalMs > 0 ? Math.min(1, playback.elapsedMs / playback.totalMs) : 0
  const paused = playback.status === 'paused'

  return (
    <section className="session-hud" aria-label="Session playback">
      <div className="session-hud__top">
        <div className="session-hud__identity">
          <span className="session-hud__eyebrow">{paused ? 'Session paused' : 'Session in progress'}</span>
          <strong>{playback.sessionName}</strong>
        </div>
        <span className="session-hud__time">
          {formatDurationMs(playback.elapsedMs)} <i>/</i> {formatDurationMs(playback.totalMs)}
        </span>
      </div>
      <div className="session-hud__segment">
        <span>{playback.segmentLabel || 'Passage'}</span>
        <span>Passage {playback.segmentIndex + 1}</span>
      </div>
      <div
        className="session-hud__progress"
        role="progressbar"
        aria-label="Session progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <span style={{ transform: `scaleX(${Math.max(0.001, progress)})` }} />
      </div>
      <div className="session-hud__controls">
        <button
          type="button"
          className="session-hud__button"
          aria-label={paused ? 'Resume session' : 'Pause session'}
          onClick={() => {
            if (paused) void runtime.resumeSession()
            else runtime.pauseSession()
          }}
        >
          {paused ? (
            <Play size={14} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Pause size={14} strokeWidth={1.5} aria-hidden="true" />
          )}
          <span>{paused ? 'Resume' : 'Pause'}</span>
        </button>
        <button
          type="button"
          className="session-hud__button session-hud__button--quiet"
          aria-label="End session"
          onClick={runtime.stopSession}
        >
          <Square size={11} strokeWidth={1.5} aria-hidden="true" />
          <span>End</span>
        </button>
      </div>
    </section>
  )
}

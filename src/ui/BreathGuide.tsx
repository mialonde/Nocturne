import { Pause, Play } from 'lucide-react'
import { BREATH_PHASE_LABEL } from '../config/audio'
import { useNocturneRuntime } from '../runtime/NocturneRuntime'
import { useNocturneStore } from '../store/useNocturneStore'
import { useBreathState } from './hooks/useBreathState'
import type { CSSProperties } from 'react'

export function BreathGuide() {
  const runtime = useNocturneRuntime()
  const mode = useNocturneStore((state) => state.mode)
  const breathRunning = useNocturneStore((state) => state.breathRunning)
  const setBreathRunning = useNocturneStore((state) => state.setBreathRunning)
  const active = mode === 'breath' && breathRunning
  const state = useBreathState(runtime.getBreathState, active)

  if (mode !== 'breath') return null
  const phaseLabel = state ? BREATH_PHASE_LABEL[state.phase] : 'Breathe'
  const seconds = state ? Math.max(0, Math.ceil(state.phaseRemainingMs / 1000)) : 0
  const progress = state?.phaseProgress ?? 0
  const running = state?.running ?? false
  const ringStyle = {
    '--phase-progress': Math.min(1, Math.max(0, progress)),
  } as CSSProperties

  return (
    <aside className="breath-guide" aria-label="Breathing guidance">
      <div className="breath-guide__ring" style={ringStyle}>
        <div className="breath-guide__ring-inner">
          <span>{phaseLabel}</span>
          <strong>{running ? seconds : '—'}</strong>
        </div>
      </div>
      <div className="breath-guide__copy">
        <span className="breath-guide__eyebrow">{running ? 'Follow the light' : 'Guidance paused'}</span>
        <p>
          {running
            ? 'Let the phase pass without forcing the breath.'
            : 'Resume when you are ready. The room keeps breathing with you.'}
        </p>
        <button
          type="button"
          className="breath-guide__control"
          aria-label={running ? 'Pause breathing guidance' : 'Resume breathing guidance'}
          onClick={() => setBreathRunning(!running)}
        >
          {running ? (
            <Pause size={12} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Play size={12} strokeWidth={1.5} aria-hidden="true" />
          )}
          <span>{running ? 'Pause' : 'Resume'}</span>
        </button>
      </div>
    </aside>
  )
}

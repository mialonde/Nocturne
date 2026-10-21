import { Pause, Play, RotateCcw, Square, Wind } from 'lucide-react'
import type { CSSProperties } from 'react'
import { BREATH_PHASE_LABEL, getBreathCycleDuration } from '../../config/audio'
import { useNocturneRuntime } from '../../runtime/NocturneRuntime'
import { useNocturneStore } from '../../store/useNocturneStore'
import type { BreathPattern } from '../../types'
import { formatLongDuration, formatDurationMs } from '../format'
import { useBreathState } from '../hooks/useBreathState'
import { NumberField, Toggle } from '../components/controls'
import { PanelNote, PanelSection } from './PanelSection'
import { PanelShell } from './PanelShell'

const PATTERN_PRESETS: { label: string; pattern: BreathPattern }[] = [
  { label: 'Unwind · 4 / 2 / 6 / 2', pattern: { inhale: 4, hold: 2, exhale: 6, rest: 2 } },
  { label: 'Box · 4 / 4 / 4 / 4', pattern: { inhale: 4, hold: 4, exhale: 4, rest: 4 } },
  { label: 'Coherent · 5 / 0 / 5 / 0', pattern: { inhale: 5, hold: 0, exhale: 5, rest: 0 } },
  { label: 'Long exhale · 4 / 0 / 8 / 0', pattern: { inhale: 4, hold: 0, exhale: 8, rest: 0 } },
]

export function BreathPanel() {
  const runtime = useNocturneRuntime()
  const mode = useNocturneStore((state) => state.mode)
  const breathRunning = useNocturneStore((state) => state.breathRunning)
  const pattern = useNocturneStore((state) => state.breathPattern)
  const cues = useNocturneStore((state) => state.breathCues)
  const setMode = useNocturneStore((state) => state.setMode)
  const setBreathRunning = useNocturneStore((state) => state.setBreathRunning)
  const setBreathPattern = useNocturneStore((state) => state.setBreathPattern)
  const setBreathCues = useNocturneStore((state) => state.setBreathCues)
  const audioBinaural = useNocturneStore((state) => state.audio.binauralEnabled)
  const audioPlaying = useNocturneStore((state) => state.audioStatus === 'playing')
  const breathActive = mode === 'breath' && breathRunning
  const state = useBreathState(runtime.getBreathState, breathActive)
  const inBreathMode = mode === 'breath'
  const cycle = getBreathCycleDuration(pattern)
  const progress = state?.phaseProgress ?? 0
  const ringStyle = {
    '--phase-progress': Math.min(1, Math.max(0, progress)),
  } as CSSProperties

  const begin = () => {
    runtime.environment?.resetBreathing()
    setMode('breath')
  }

  const resume = () => {
    setMode('breath')
    setBreathRunning(true)
  }

  const stop = () => {
    runtime.environment?.resetBreathing()
    setBreathRunning(false)
    setMode(audioBinaural ? 'binaural' : 'ambient')
  }

  return (
    <PanelShell
      id="breath"
      title="Breath"
      eyebrow="Guided rhythm / independent of the room"
      actions={
        <span className={`status-chip ${breathActive ? 'is-live' : ''}`.trim()}>
          {breathActive ? 'Guiding' : inBreathMode ? 'Paused' : 'Natural'}
        </span>
      }
    >
      <PanelSection title="Guidance" eyebrow="No voice / no pressure">
        <p className="panel-copy">
          The environment has its own slow motion. Guided breathing layers a separate, optional
          rhythm over it. Nothing is spoken, and you can leave at any moment.
        </p>

        {inBreathMode ? (
          <div className="breath-panel-display">
            <div className="breath-panel-display__ring" style={ringStyle}>
              <div>
                <span>{state ? BREATH_PHASE_LABEL[state.phase] : 'Ready'}</span>
                <strong>
                  {state && state.running ? Math.max(0, Math.ceil(state.phaseRemainingMs / 1000)) : '—'}
                </strong>
              </div>
            </div>
            <div className="breath-panel-display__meta">
              <span>Current cycle</span>
              <strong>{formatLongDuration(cycle)}</strong>
              <span>
                {state ? `Cycle ${state.cycleCount + 1}` : 'Waiting for guidance'}
                {state && state.running ? ` · ${formatDurationMs(Math.max(0, state.phaseRemainingMs))} remaining` : ''}
              </span>
            </div>
          </div>
        ) : (
          <div className="breath-panel-intro">
            <Wind size={24} strokeWidth={1.2} aria-hidden="true" />
            <div>
              <strong>Let the next breath arrive.</strong>
              <p>A soft ring marks each phase. Sound cues are optional and absent by default.</p>
            </div>
          </div>
        )}

        <div className="button-row">
          {!inBreathMode ? (
            <button type="button" className="button button--primary" onClick={begin}>
              <Play size={14} strokeWidth={1.5} aria-hidden="true" />
              Begin breathing
            </button>
          ) : breathRunning ? (
            <button type="button" className="button button--outline" onClick={() => setBreathRunning(false)}>
              <Pause size={14} strokeWidth={1.5} aria-hidden="true" />
              Pause guidance
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={resume}>
              <Play size={14} strokeWidth={1.5} aria-hidden="true" />
              Resume guidance
            </button>
          )}
          {inBreathMode ? (
            <>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => runtime.environment?.resetBreathing()}
                disabled={!breathRunning}
              >
                <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
                Restart cycle
              </button>
              <button type="button" className="button button--ghost" onClick={stop}>
                <Square size={12} strokeWidth={1.5} aria-hidden="true" />
                End guidance
              </button>
            </>
          ) : null}
        </div>

        <Toggle
          label="Soft phase cues"
          checked={cues}
          onChange={setBreathCues}
          description={
            audioPlaying
              ? 'A quiet tone marks each phase. It follows the master bus.'
              : 'Sound begins only when the room is audible; the ring still guides in silence.'
          }
        />
      </PanelSection>

      <PanelSection title="Pattern" eyebrow="Inhale / hold / exhale / rest">
        <div className="pattern-grid">
          <NumberField
            label="Inhale"
            value={pattern.inhale}
            min={1}
            max={60}
            suffix="sec"
            onChange={(inhale) => setBreathPattern({ inhale })}
          />
          <NumberField
            label="Hold"
            value={pattern.hold}
            min={0}
            max={60}
            suffix="sec"
            onChange={(hold) => setBreathPattern({ hold })}
          />
          <NumberField
            label="Exhale"
            value={pattern.exhale}
            min={1}
            max={60}
            suffix="sec"
            onChange={(exhale) => setBreathPattern({ exhale })}
          />
          <NumberField
            label="Rest"
            value={pattern.rest}
            min={0}
            max={60}
            suffix="sec"
            onChange={(rest) => setBreathPattern({ rest })}
          />
        </div>
        <div className="preset-row preset-row--wide">
          {PATTERN_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setBreathPattern(preset.pattern)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="control-hint">One full cycle: {formatLongDuration(cycle)}.</p>
      </PanelSection>

      <PanelNote tone="warning">
        Breathe gently rather than forcing a pattern. Stop if you feel light-headed or
        uncomfortable. This guidance is not medical care.
      </PanelNote>
    </PanelShell>
  )
}

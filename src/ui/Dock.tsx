import {
  Clapperboard,
  ListMusic,
  LoaderCircle,
  Pause,
  Play,
  SlidersHorizontal,
  Square,
  Wind,
} from 'lucide-react'
import type { PanelId } from '../types'
import { useTranslation } from '../language/useTranslation'
import { useNocturneRuntime } from '../runtime/NocturneRuntime'
import { useNocturneStore } from '../store/useNocturneStore'
import { useMemo } from 'react'
import { useRecordingSnapshot } from './hooks/useRecordingSnapshot'

export function Dock() {
  const { t } = useTranslation()
  const runtime = useNocturneRuntime()
  const audioStatus = useNocturneStore((state) => state.audioStatus)
  const activePanel = useNocturneStore((state) => state.activePanel)
  const togglePanel = useNocturneStore((state) => state.togglePanel)
  const sessionActive = useNocturneStore((state) => state.sessionPlayback.status !== 'idle')
  const recording = useRecordingSnapshot(runtime.recording)
  const ambienceTrackVolumes = useNocturneStore((state) => state.ambienceTrackVolumes)
  const playing = audioStatus === 'playing'
  const starting = audioStatus === 'starting'
  const canStop = playing || starting || sessionActive
  const recordingActive =
    recording.phase === 'recording' ||
    recording.phase === 'paused' ||
    recording.phase === 'processing'

  const activeAmbienceCount = useMemo(
    () => Object.values(ambienceTrackVolumes).filter((vol) => (vol ?? 0) > 0.001).length,
    [ambienceTrackVolumes],
  )

  const panelButtons: { id: PanelId; label: string; Icon: typeof SlidersHorizontal }[] = [
    { id: 'sound', label: t('dock.sound'), Icon: SlidersHorizontal },
    { id: 'breath', label: t('dock.breath'), Icon: Wind },
    { id: 'session', label: t('dock.session'), Icon: ListMusic },
    { id: 'studio', label: t('dock.record'), Icon: Clapperboard },
  ]

  return (
    <nav className="dock" aria-label={t('dock.controls')}>
      <button
        type="button"
        className="dock__transport dock__transport--primary"
        aria-label={starting ? t('dock.loading') : playing ? t('dock.pause') : t('dock.play')}
        title={playing ? `${t('dock.pause')} (Space)` : `${t('dock.play')} (Space)`}
        disabled={starting}
        onClick={() => void runtime.togglePlayback()}
      >
        {starting ? (
          <LoaderCircle className="spin" size={20} strokeWidth={1.5} aria-hidden="true" />
        ) : playing ? (
          <Pause size={18} strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <Play size={18} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className="dock__transport"
        aria-label={t('dock.stop')}
        title={t('dock.stopTitle')}
        disabled={!canStop}
        onClick={runtime.stopAll}
      >
        <Square size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>

      <span className="dock__separator" aria-hidden="true" />

      <div className="dock__panels">
        {panelButtons.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`dock__panel ${activePanel === id ? 'is-active' : ''}`.trim()}
            aria-label={t('dock.panelLabel', { name: label })}
            aria-pressed={activePanel === id}
            title={label}
            onClick={() => togglePanel(id)}
          >
            <Icon size={17} strokeWidth={1.4} aria-hidden="true" />
            <span>{label}</span>
            {id === 'sound' && activeAmbienceCount > 0 ? (
              <span
                className="dock__badge"
                aria-label={t('dock.activeLayers', { count: activeAmbienceCount })}
                title={t('dock.activeLayers', { count: activeAmbienceCount })}
              >
                {activeAmbienceCount}
              </span>
            ) : null}
            {id === 'studio' && recordingActive ? (
              <span
                className="dock__record-dot"
                aria-label={t('dock.recordingInProgress')}
              />
            ) : null}
          </button>
        ))}
      </div>
    </nav>
  )
}

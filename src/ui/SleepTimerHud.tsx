import { MoonStar, Plus } from 'lucide-react'
import type React from 'react'
import { useTranslation } from '../language/useTranslation'
import { useNocturneRuntime } from '../runtime/NocturneRuntime'
import { useNocturneStore } from '../store/useNocturneStore'
import { formatDurationMs } from './format'

export function SleepTimerHud({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const runtime = useNocturneRuntime()
  const timer = useNocturneStore((state) => state.sleepTimer)
  const setActivePanel = useNocturneStore((state) => state.setPanel)
  const extendSleepTimer = useNocturneStore((state) => state.extendSleepTimer)
  const showToast = useNocturneStore((state) => state.showToast)

  if (!timer.endsAt) return null

  const isFading = timer.remainingMs <= 60_000
  const totalMs = Math.max(1, (timer.minutes ?? 1) * 60_000)
  const progressRatio = Math.max(0, Math.min(1, timer.remainingMs / totalMs))

  const handleExtend = (event: React.MouseEvent) => {
    event.stopPropagation()
    runtime.audio.resetSleepFade(0.15)
    extendSleepTimer(15)
    showToast(t('sleep.extendedToast', { minutes: 15 }), 'quiet')
  }

  return (
    <aside
      className={`sleep-timer-hud ${compact ? 'is-compact' : ''} ${isFading ? 'is-fading' : ''}`.trim()}
      role="status"
      aria-label={t('sleep.title')}
    >
      <button
        type="button"
        className="sleep-timer-hud__main"
        title={t('sleep.hudTitle')}
        onClick={() => setActivePanel('sound')}
      >
        <span className="sleep-timer-hud__icon-wrap">
          <MoonStar size={13} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="sleep-timer-hud__info">
          <span className="sleep-timer-hud__label">{t('sleep.active')}</span>
          <strong className="sleep-timer-hud__time">{formatDurationMs(timer.remainingMs)}</strong>
        </div>
      </button>

      <button
        type="button"
        className="sleep-timer-hud__quick-extend"
        onClick={handleExtend}
        title={`${t('sleep.extend')} +15m`}
        aria-label={`${t('sleep.extend')} +15m`}
      >
        <Plus size={11} strokeWidth={2} aria-hidden="true" />
        <span>15m</span>
      </button>

      <div className="sleep-timer-hud__progress-track" aria-hidden="true">
        <div
          className="sleep-timer-hud__progress-fill"
          style={{ width: `${Math.round(progressRatio * 100)}%` }}
        />
      </div>
    </aside>
  )
}

import { MoonStar } from 'lucide-react'
import { useTranslation } from '../language/useTranslation'
import { useNocturneStore } from '../store/useNocturneStore'
import { formatDurationMs } from './format'

export function SleepTimerHud() {
  const { t } = useTranslation()
  const timer = useNocturneStore((state) => state.sleepTimer)
  const setActivePanel = useNocturneStore((state) => state.setPanel)
  if (!timer.endsAt) return null

  return (
    <button
      type="button"
      className="sleep-timer-hud"
      title={t('sleep.hudTitle')}
      aria-label={t('sleep.title')}
      onClick={() => setActivePanel('sound')}
    >
      <MoonStar size={13} strokeWidth={1.5} aria-hidden="true" />
      <span className="sleep-timer-hud__label">{t('sleep.active')}</span>
      <strong>{formatDurationMs(timer.remainingMs)}</strong>
    </button>
  )
}

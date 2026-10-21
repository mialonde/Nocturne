import { useTranslation } from '../../language/useTranslation'
import { useNocturneRuntime } from '../../runtime/NocturneRuntime'
import { useNocturneStore } from '../../store/useNocturneStore'
import { formatDurationMs } from '../format'

const DURATIONS = [5, 10, 20, 30, 45, 60]

export function SleepTimerControl() {
  const { t } = useTranslation()
  const runtime = useNocturneRuntime()
  const timer = useNocturneStore((state) => state.sleepTimer)
  const setSleepTimer = useNocturneStore((state) => state.setSleepTimer)
  const extendSleepTimer = useNocturneStore((state) => state.extendSleepTimer)
  const clearSleepTimer = useNocturneStore((state) => state.clearSleepTimer)
  const showToast = useNocturneStore((state) => state.showToast)
  const active = timer.endsAt !== null

  const choose = (minutes: number) => {
    runtime.audio.resetSleepFade(0.15)
    setSleepTimer(minutes)
    showToast(t('sleep.setToast', { minutes }), 'quiet')
  }

  const extend = (minutes: number) => {
    runtime.audio.resetSleepFade(0.15)
    extendSleepTimer(minutes)
    showToast(t('sleep.extendedToast', { minutes }), 'quiet')
  }

  const cancel = () => {
    clearSleepTimer()
    runtime.audio.resetSleepFade(0.3)
    showToast(t('sleep.cancelledToast'), 'quiet')
  }

  return (
    <div className="sleep-timer">
      {active ? (
        <div className="sleep-timer__active-bar">
          <p className="sleep-timer__remaining" aria-live="polite">
            {t('sleep.remaining', { time: formatDurationMs(timer.remainingMs) })}
          </p>
          <div className="sleep-timer__extend-group" role="group" aria-label={t('sleep.extend')}>
            <span className="sleep-timer__extend-title">{t('sleep.extend')}:</span>
            <button
              type="button"
              className="sleep-timer__extend-btn"
              onClick={() => extend(15)}
              aria-label={t('sleep.extend15')}
            >
              {t('sleep.extend15')}
            </button>
            <button
              type="button"
              className="sleep-timer__extend-btn"
              onClick={() => extend(30)}
              aria-label={t('sleep.extend30')}
            >
              {t('sleep.extend30')}
            </button>
          </div>
        </div>
      ) : null}
      <p className="panel-copy">{t('sleep.copy')}</p>
      <div className="sleep-timer__options" role="group" aria-label={t('sleep.title')}>
        <button
          type="button"
          className={!active ? 'is-active' : ''}
          aria-pressed={!active}
          onClick={cancel}
        >
          {t('sleep.off')}
        </button>
        {DURATIONS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className={active && timer.minutes === minutes ? 'is-active' : ''}
            aria-pressed={active && timer.minutes === minutes}
            onClick={() => choose(minutes)}
          >
            {t('sleep.option', { minutes })}
          </button>
        ))}
      </div>
      <p className="control-hint">{t('sleep.fadeNote')}</p>
    </div>
  )
}

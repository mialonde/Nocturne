import { Headphones } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../language/useTranslation'
import { useNocturneRuntime } from '../../runtime/NocturneRuntime'
import { useNocturneStore } from '../../store/useNocturneStore'

type CheckSide = 'left' | 'right' | 'both'

export function BinauralCheck() {
  const { t } = useTranslation()
  const runtime = useNocturneRuntime()
  const showToast = useNocturneStore((state) => state.showToast)
  const [testing, setTesting] = useState<CheckSide | null>(null)
  const resetTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    }
  }, [])

  const play = (side: CheckSide) => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    setTesting(side)
    void runtime.audio.playBinauralCheck(side).catch(() => {
      setTesting(null)
      showToast(t('binauralCheck.error'), 'warning')
    })
    resetTimer.current = window.setTimeout(() => {
      resetTimer.current = null
      setTesting(null)
    }, 1550)
  }

  const sides: { id: CheckSide; label: string }[] = [
    { id: 'left', label: t('binauralCheck.left') },
    { id: 'right', label: t('binauralCheck.right') },
    { id: 'both', label: t('binauralCheck.both') },
  ]

  const playingLabel =
    testing === 'left'
      ? t('binauralCheck.playingLeft')
      : testing === 'right'
        ? t('binauralCheck.playingRight')
        : t('binauralCheck.playingBoth')

  return (
    <div className="binaural-check">
      <div className="binaural-check__heading">
        <span className="section-icon" aria-hidden="true">
          <Headphones size={15} strokeWidth={1.4} />
        </span>
        <div>
          <strong>{t('binauralCheck.title')}</strong>
          <span>{t('binauralCheck.eyebrow')}</span>
        </div>
      </div>
      <p className="panel-copy">{t('binauralCheck.copy')}</p>
      <div className="binaural-check__buttons" role="group" aria-label={t('binauralCheck.testGroup')}>
        {sides.map((side) => (
          <button
            key={side.id}
            type="button"
            className={testing === side.id ? 'is-active' : ''}
            aria-pressed={testing === side.id}
            onClick={() => play(side.id)}
          >
            {side.label}
          </button>
        ))}
      </div>
      <p className="binaural-check__status" aria-live="polite">
        {testing ? t('binauralCheck.playing', { side: playingLabel }) : t('binauralCheck.ready')}
      </p>
      <p className="binaural-check__note">{t('binauralCheck.detectionNote')}</p>
    </div>
  )
}

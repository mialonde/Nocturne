import { Headphones, Play } from 'lucide-react'
import { THEMES } from '../config/themes'
import { useTranslation } from '../language/useTranslation'
import { useNocturneRuntime } from '../runtime/NocturneRuntime'
import { useNocturneStore } from '../store/useNocturneStore'

export function BeginGate() {
  const { t } = useTranslation()
  const runtime = useNocturneRuntime()
  const theme = useNocturneStore((state) => state.theme)
  const status = useNocturneStore((state) => state.audioStatus)
  const isCosmos = theme === 'cosmos'

  return (
    <div className="begin-gate">
      <div className="begin-gate__brand">
        <span className="wordmark wordmark--large">NOCTURNE</span>
        <span className="wordmark__sub">{t('begin.tagline')}</span>
      </div>

      <div className="begin-gate__center">
        <p className="begin-gate__eyebrow">
          {isCosmos
            ? t('begin.cosmos.eyebrow')
            : t('begin.theme.eyebrow', {
                theme: THEMES[theme].name,
                subtitle: THEMES[theme].subtitle,
              })}
        </p>
        <p className="begin-gate__line">
          {isCosmos ? t('begin.cosmos.line') : t('begin.standard.line')}
        </p>
        <button
          type="button"
          className="begin-button"
          onClick={() => void runtime.beginExperience()}
          disabled={status === 'starting'}
        >
          <span className="begin-button__ring" aria-hidden="true" />
          <span className="begin-button__ring begin-button__ring--outer" aria-hidden="true" />
          <Play size={17} strokeWidth={1.3} aria-hidden="true" />
          <span>
            {status === 'starting'
              ? t('begin.starting')
              : isCosmos
                ? t('begin.cosmos.button')
                : t('begin.standard.button')}
          </span>
        </button>
        <p className="begin-gate__hint">{t('begin.hint')}</p>
      </div>

      <div className="begin-gate__foot">
        <span>
          <Headphones size={13} strokeWidth={1.4} aria-hidden="true" /> {t('begin.headphones')}
        </span>
        <span className="begin-gate__keys">
          <kbd>{t('begin.space')}</kbd> {t('begin.enterAfter')}
        </span>
      </div>
    </div>
  )
}

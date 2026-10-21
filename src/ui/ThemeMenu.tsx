import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { THEME_LIST, THEMES } from '../config/themes'
import { useTranslation } from '../language/useTranslation'
import { useNocturneStore } from '../store/useNocturneStore'
import type { ThemeId } from '../types'

export function ThemeMenu() {
  const { t } = useTranslation()
  const theme = useNocturneStore((state) => state.theme)
  const setTheme = useNocturneStore((state) => state.setTheme)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const active = THEMES[theme]

  useEffect(() => {
    if (!open) return
    const handlePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const choose = (next: ThemeId) => {
    setTheme(next)
    setOpen(false)
  }

  return (
    <div className="theme-picker" ref={rootRef}>
      <button
        type="button"
        className="theme-picker__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('theme.menuLabel')}: ${active.name}. ${t('theme.open')}.`}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className={`theme-picker__swatch${theme === 'cosmos' ? ' theme-picker__swatch--cosmos' : ''}`}
          style={theme !== 'cosmos' ? { background: active.swatch } : undefined}
        />
        <span className="theme-picker__name">{active.name}</span>
        <ChevronDown size={13} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {open ? (
        <div className="theme-picker__menu" role="menu" aria-label={t('theme.menuLabel')}>
          <p className="theme-picker__heading">{t('theme.menuLabel')}</p>
          {THEME_LIST.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={item.id === theme}
              className={`theme-option ${item.id === theme ? 'is-active' : ''}`.trim()}
              onClick={() => choose(item.id)}
            >
              <span
                className={`theme-option__swatch${item.id === 'cosmos' ? ' theme-option__swatch--cosmos' : ''}`}
                style={item.id !== 'cosmos' ? { background: item.swatch } : undefined}
              />
              <span className="theme-option__copy">
                <span className="theme-option__name">{item.name}</span>
                <span className="theme-option__subtitle">{item.subtitle}</span>
              </span>
              {item.id === theme ? <Check size={14} strokeWidth={1.5} aria-hidden="true" /> : null}
            </button>
          ))}
          <p className="theme-picker__note">{t('theme.note')}</p>
        </div>
      ) : null}
    </div>
  )
}

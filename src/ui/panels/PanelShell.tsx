import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTranslation } from '../../language/useTranslation'
import { useNocturneStore } from '../../store/useNocturneStore'

interface PanelShellProps {
  id: string
  title: string
  eyebrow: string
  children: ReactNode
  wide?: boolean
  actions?: ReactNode
}

export function PanelShell({ id, title, eyebrow, children, wide, actions }: PanelShellProps) {
  const { t } = useTranslation()
  const closePanel = useNocturneStore((state) => state.setPanel)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => {
      previous?.focus()
    }
  }, [])

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    if (!focusables || focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className={`panel-layer ${wide ? 'panel-layer--wide' : ''}`.trim()}>
      <button
        type="button"
        className="panel-backdrop"
        aria-label={t('panel.close')}
        onClick={() => closePanel(null)}
      />
      <div
        className={`panel-shell ${wide ? 'panel-shell--wide' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        ref={panelRef}
        onKeyDown={handleKeyDown}
      >
        <header className="panel-shell__header">
          <div>
            <p className="panel-shell__eyebrow">{eyebrow}</p>
            <h2 id={`${id}-title`}>{title}</h2>
          </div>
          <div className="panel-shell__header-actions">
            {actions}
            <button
              type="button"
              ref={closeRef}
              className="panel-shell__close"
              aria-label={t('panel.close')}
              onClick={() => closePanel(null)}
            >
              <X size={17} strokeWidth={1.4} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="panel-shell__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

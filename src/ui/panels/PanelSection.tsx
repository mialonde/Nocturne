import type { ReactNode } from 'react'

export function PanelSection({
  title,
  eyebrow,
  children,
  actions,
  quiet,
}: {
  title: string
  eyebrow?: string
  children: ReactNode
  actions?: ReactNode
  quiet?: boolean
}) {
  return (
    <section className={`panel-section ${quiet ? 'is-quiet' : ''}`.trim()}>
      <header className="panel-section__head">
        <div>
          {eyebrow ? <p className="panel-section__eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
        </div>
        {actions ? <div className="panel-section__actions">{actions}</div> : null}
      </header>
      <div className="panel-section__body">{children}</div>
    </section>
  )
}

export function PanelNote({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'warning' | 'privacy'
}) {
  return <div className={`panel-note panel-note--${tone}`}>{children}</div>
}

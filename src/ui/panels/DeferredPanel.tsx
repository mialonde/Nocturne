import { Component, Suspense, type ReactNode } from 'react'
import { useTranslation } from '../../language/useTranslation'
import { PanelShell } from './PanelShell'

class PanelErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export function DeferredPanel({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const fallback = (failed: boolean) => (
    <PanelShell id="panel-load" title="NOCTURNE" eyebrow="">
      <p role={failed ? 'alert' : 'status'}>{t(failed ? 'panel.loadError' : 'dock.loading')}</p>
    </PanelShell>
  )
  return (
    <PanelErrorBoundary fallback={fallback(true)}>
      <Suspense fallback={fallback(false)}>{children}</Suspense>
    </PanelErrorBoundary>
  )
}

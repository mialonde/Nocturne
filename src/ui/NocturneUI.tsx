import { lazy, useEffect } from 'react'
import { Eye } from 'lucide-react'
import { useTranslation } from '../language/useTranslation'
import { useNocturneRuntime } from '../runtime/NocturneRuntime'
import { useNocturneStore } from '../store/useNocturneStore'
import { BeginGate } from './BeginGate'
import { BreathGuide } from './BreathGuide'
import { ContextLostNotice } from './ContextLostNotice'
import { Dock } from './Dock'
import { FrequencyReadout } from './FrequencyReadout'
import { RecordingHud } from './RecordingHud'
import { SessionHud } from './SessionHud'
import { SleepTimerController } from './SleepTimerController'
import { SleepTimerHud } from './SleepTimerHud'
import { ToastViewport } from './ToastViewport'
import { SimulatorOverlay } from './SimulatorOverlay'
import { TopBar } from './TopBar'
import { DeferredPanel } from './panels/DeferredPanel'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useRecordingNotifications } from './hooks/useRecordingNotifications'
import { BreathPanel } from './panels/BreathPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { SoundPanel } from './panels/SoundPanel'
const StudioPanel = lazy(() => import('./panels/StudioPanel').then((module) => ({ default: module.StudioPanel })))
const SessionDesigner = lazy(() => import('./designer/SessionDesigner').then((module) => ({ default: module.SessionDesigner })))

function ActivePanel() {
  const activePanel = useNocturneStore((state) => state.activePanel)
  if (!activePanel) return null
  if (activePanel === 'sound') return <SoundPanel />
  if (activePanel === 'breath') return <BreathPanel />
  if (activePanel === 'studio') return <StudioPanel />
  if (activePanel === 'settings') return <SettingsPanel />
  return <SessionDesigner />
}

export function NocturneUI() {
  const runtime = useNocturneRuntime()
  const { t } = useTranslation()
  const experienceStarted = useNocturneStore((state) => state.experienceStarted)
  const uiHidden = useNocturneStore((state) => state.isUiHidden)
  const activePanel = useNocturneStore((state) => state.activePanel)
  const mode = useNocturneStore((state) => state.mode)
  const theme = useNocturneStore((state) => state.theme)
  const language = useNocturneStore((state) => state.language)
  const setUiHidden = useNocturneStore((state) => state.setUiHidden)
  useKeyboardShortcuts()
  useRecordingNotifications(runtime.recording)

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [language])

  const isCosmos = theme === 'cosmos'

  return (
    <>
      <SleepTimerController />
      {!experienceStarted ? <BeginGate /> : null}

      {/* 6D Consciousness Simulator minimal interface */}
      {experienceStarted && !uiHidden && isCosmos ? <SimulatorOverlay /> : null}

      {/* Standard Nocturne interface for other atmosphere modes */}
      {experienceStarted && !uiHidden && !isCosmos ? <TopBar /> : null}
      {experienceStarted && !uiHidden && !isCosmos ? <FrequencyReadout /> : null}
      {experienceStarted && !uiHidden && !isCosmos && mode === 'breath' ? <BreathGuide /> : null}
      {experienceStarted && !uiHidden && !isCosmos ? <SessionHud /> : null}
      {experienceStarted && !isCosmos ? <SleepTimerHud compact={uiHidden} /> : null}
      {experienceStarted && !uiHidden && !isCosmos ? <Dock /> : null}
      {experienceStarted ? <RecordingHud compact={uiHidden} /> : null}

      {experienceStarted && uiHidden ? (
        <button
          type="button"
          className="ui-restore"
          aria-label={t('topbar.show')}
          title={`${t('topbar.show')} (H)`}
          onClick={() => setUiHidden(false)}
        >
          <Eye size={16} strokeWidth={1.4} aria-hidden="true" />
        </button>
      ) : null}

      {experienceStarted && !uiHidden && activePanel ? (
        <DeferredPanel key={activePanel}><ActivePanel /></DeferredPanel>
      ) : null}
      <ContextLostNotice />
      <ToastViewport />
    </>
  )
}

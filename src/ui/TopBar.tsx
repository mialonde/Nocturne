import { EyeOff, Maximize2, Mic, Minimize2, Settings2 } from 'lucide-react'
import { useTranslation } from '../language/useTranslation'
import { useNocturneRuntime } from '../runtime/NocturneRuntime'
import { useNocturneStore } from '../store/useNocturneStore'
import type { ExperienceMode } from '../types'
import { Slider } from './components/controls'
import { ThemeMenu } from './ThemeMenu'

function TopBarMixer() {
  const { t } = useTranslation()
  const audio = useNocturneStore((state) => state.audio)
  const updateAudio = useNocturneStore((state) => state.updateAudio)

  return (
    <div className="top-mixer" role="group" aria-label={t('topbar.mixerGroup')}>
      <Slider
        label={t('topbar.mixer.ambient')}
        className="top-mixer__slider"
        value={audio.ambientMaster}
        min={0}
        max={1}
        step={0.01}
        onChange={(ambientMaster) => updateAudio({ ambientMaster })}
        format={(value) => `${Math.round(value * 100)}%`}
      />
      <Slider
        label={t('topbar.mixer.binaural')}
        className="top-mixer__slider"
        value={audio.binauralVolume}
        min={0}
        max={1}
        step={0.01}
        onChange={(binauralVolume) => updateAudio({ binauralVolume })}
        format={(value) => `${Math.round(value * 100)}%`}
      />
    </div>
  )
}

export function TopBar() {
  const { t } = useTranslation()
  const runtime = useNocturneRuntime()
  const mode = useNocturneStore((state) => state.mode)
  const setMode = useNocturneStore((state) => state.setMode)
  const audioStatus = useNocturneStore((state) => state.audioStatus)
  const sessionActive = useNocturneStore((state) => state.sessionPlayback.status !== 'idle')
  const micStatus = useNocturneStore((state) => state.micStatus)
  const setPanel = useNocturneStore((state) => state.setPanel)
  const setUiHidden = useNocturneStore((state) => state.setUiHidden)

  const modes: { id: ExperienceMode; label: string; description: string }[] = [
    {
      id: 'ambient',
      label: t('topbar.mode.ambient'),
      description: t('topbar.mode.ambientTitle'),
    },
    {
      id: 'binaural',
      label: t('topbar.mode.binaural'),
      description: t('topbar.mode.binauralTitle'),
    },
    {
      id: 'breath',
      label: t('topbar.mode.breath'),
      description: t('topbar.mode.breathTitle'),
    },
  ]

  const handleModeClick = async (targetMode: typeof mode) => {
    if (targetMode === 'binaural' && audioStatus !== 'playing') {
      try {
        await runtime.beginExperience()
      } catch {}
    }
    setMode(targetMode)
  }

  return (
    <header className="top-bar">
      <div className="top-bar__brand">
        <h1 className="wordmark">NOCTURNE</h1>
        <span className="wordmark__sub">{t('topbar.subtitle')}</span>
      </div>

      <div className="top-bar__center">
        <div className="mode-switch" role="group" aria-label={t('topbar.modeGroup')}>
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={mode === item.id ? 'is-active' : ''}
              aria-pressed={mode === item.id}
              title={sessionActive ? t('topbar.sessionDirecting') : item.description}
              disabled={sessionActive}
              onClick={() => void handleModeClick(item.id)}
            >
              {item.label}
              <span className="mode-switch__dot" aria-hidden="true" />
            </button>
          ))}
        </div>
        <TopBarMixer />
      </div>

      <div className="top-bar__actions">
        {micStatus === 'active' ? (
          <button
            type="button"
            className="mic-indicator"
            onClick={() => setPanel('sound')}
            title={t('topbar.micLiveTitle')}
          >
            <Mic size={13} strokeWidth={1.6} aria-hidden="true" />
            <span>{t('topbar.micLive')}</span>
          </button>
        ) : null}
        <ThemeMenu />
        <div className="top-bar__icon-group">
          <button
            type="button"
            className="icon-button"
            aria-label={t('topbar.settings')}
            title={t('topbar.settings')}
            onClick={() => setPanel('settings')}
          >
            <Settings2 size={17} strokeWidth={1.4} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={
              runtime.isFullscreen ? t('topbar.fullscreen.exit') : t('topbar.fullscreen.enter')
            }
            title={
              runtime.isFullscreen ? t('topbar.fullscreen.exit') : t('topbar.fullscreen.enter')
            }
            onClick={() => void runtime.toggleFullscreen()}
          >
            {runtime.isFullscreen ? (
              <Minimize2 size={17} strokeWidth={1.4} aria-hidden="true" />
            ) : (
              <Maximize2 size={17} strokeWidth={1.4} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t('topbar.hide')}
            title={`${t('topbar.hide')} (H)`}
            onClick={() => setUiHidden(true)}
          >
            <EyeOff size={17} strokeWidth={1.4} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}

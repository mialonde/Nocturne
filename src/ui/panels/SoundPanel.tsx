import { Headphones, Mic, ShieldCheck } from 'lucide-react'
import {
  FREQUENCY_PRESETS,
  computeBinauralPair,
  formatHz,
} from '../../config/audio'
import { useTranslation } from '../../language/useTranslation'
import { useNocturneRuntime } from '../../runtime/NocturneRuntime'
import { useNocturneStore } from '../../store/useNocturneStore'
import { BinauralCheck } from '../components/BinauralCheck'
import { SleepTimerControl } from '../components/SleepTimerControl'
import { SoundscapeProfileSelector } from '../components/SoundscapeProfileSelector'
import { PanelNote, PanelSection } from './PanelSection'
import { PanelShell } from './PanelShell'
import { Slider, Toggle } from '../components/controls'
import { ReadyExperiences } from '../features/ReadyExperiences'
import { PersonalAudioControls } from '../features/PersonalAudioControls'
import { LivingControls } from '../features/LivingControls'

export function SoundPanel() {
  const { t } = useTranslation()
  const runtime = useNocturneRuntime()
  const audio = useNocturneStore((state) => state.audio)
  const audioStatus = useNocturneStore((state) => state.audioStatus)
  const updateAudio = useNocturneStore((state) => state.updateAudio)
  const updateAmbientLayers = useNocturneStore((state) => state.updateAmbientLayers)
  const setBinauralEnabled = useNocturneStore((state) => state.setBinauralEnabled)
  const setAmbientMuted = useNocturneStore((state) => state.setAmbientMuted)
  const micStatus = useNocturneStore((state) => state.micStatus)
  const micError = useNocturneStore((state) => state.micError)
  const pair = computeBinauralPair(audio.carrier, audio.beat)
  const micAvailable =
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

  const ensureAudioPlaying = async () => {
    if (audioStatus !== 'playing') {
      try {
        await runtime.beginExperience()
      } catch {}
    }
  }

  const handleToggleBinaural = async (nextState?: boolean) => {
    const target = nextState !== undefined ? nextState : !audio.binauralEnabled
    if (target) {
      await ensureAudioPlaying()
    }
    setBinauralEnabled(target)
  }

  const applyPreset = async (suggested: number) => {
    await ensureAudioPlaying()
    updateAudio({ beat: suggested })
    if (!audio.binauralEnabled) setBinauralEnabled(true)
  }

  return (
    <PanelShell
      id="sound"
      title={t('sound.title')}
      eyebrow={t('sound.eyebrow')}
      actions={
        <button
          type="button"
          className={`status-chip is-clickable ${audio.binauralEnabled ? 'is-live' : ''}`.trim()}
          onClick={() => void handleToggleBinaural()}
          title={
            audio.binauralEnabled ? t('sound.toneDisable') : t('sound.toneEnable')
          }
          aria-pressed={audio.binauralEnabled}
        >
          {audio.binauralEnabled ? t('sound.toneActive') : t('sound.toneOff')}
        </button>
      }
    >
      <ReadyExperiences />
      <PanelSection title={t('sound.output.title')} eyebrow={t('sound.output.eyebrow')}>
        <Slider
          label={t('sound.output.master')}
          value={audio.masterVolume}
          min={0}
          max={1}
          step={0.01}
          onChange={(masterVolume) => updateAudio({ masterVolume })}
          format={(value) => `${Math.round(value * 100)}%`}
          hint={t('sound.output.masterHint')}
        />
      </PanelSection>

      <PanelSection title={t('sound.ambient.title')} eyebrow={t('sound.ambient.eyebrow')}>
        <Toggle
          label={t('sound.ambient.enabled')}
          checked={audio.ambientEnabled}
          onChange={(ambientEnabled) => updateAudio({ ambientEnabled })}
          description={t('sound.ambient.enabledHint')}
        />
        <Toggle
          label={t('sound.ambient.mute')}
          checked={audio.ambientMuted}
          onChange={setAmbientMuted}
          description={t('sound.ambient.muteHint')}
        />
        <Slider
          label={t('sound.ambient.level')}
          value={audio.ambientMaster}
          min={0}
          max={1}
          step={0.01}
          onChange={(ambientMaster) => updateAudio({ ambientMaster })}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <SoundscapeProfileSelector />
        <div className="layer-grid">
          <Slider
            label={t('sound.layers.drone')}
            value={audio.layers.drone}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => updateAmbientLayers({ drone: value })}
            format={(value) => `${Math.round(value * 100)}%`}
          />
          <Slider
            label={t('sound.layers.harmony')}
            value={audio.layers.harmony}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => updateAmbientLayers({ harmony: value })}
            format={(value) => `${Math.round(value * 100)}%`}
          />
          <Slider
            label={t('sound.layers.wind')}
            value={audio.layers.wind}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => updateAmbientLayers({ wind: value })}
            format={(value) => `${Math.round(value * 100)}%`}
          />
          <Slider
            label={t('sound.layers.resonance')}
            value={audio.layers.resonance}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => updateAmbientLayers({ resonance: value })}
            format={(value) => `${Math.round(value * 100)}%`}
          />
        </div>
        <Toggle
          label={t('sound.ambient.reverb')}
          checked={audio.reverbEnabled}
          onChange={(reverbEnabled) => updateAudio({ reverbEnabled })}
          description={t('sound.ambient.reverbHint')}
        />
      </PanelSection>

      <PanelSection
        title={t('sound.binaural.title')}
        eyebrow={t('sound.binaural.eyebrow')}
        actions={
          <span className="section-icon" aria-hidden="true">
            <Headphones size={15} strokeWidth={1.4} />
          </span>
        }
      >
        <Toggle
          label={t('sound.binaural.enabled')}
          checked={audio.binauralEnabled}
          onChange={(val) => void handleToggleBinaural(val)}
          description={t('sound.binaural.enabledHint')}
        />
        <div className="binaural-readout">
          <div>
            <span>{t('sound.binaural.leftCarrier')}</span>
            <strong>{formatHz(pair.left, 2)}</strong>
          </div>
          <div>
            <span>{t('sound.binaural.rightCarrier')}</span>
            <strong>{formatHz(pair.right, 2)}</strong>
          </div>
          <div className="binaural-readout__beat">
            <span>Δ</span>
            <strong>{formatHz(pair.beat, 2)}</strong>
          </div>
        </div>
        <div className="preset-row" role="group" aria-label={t('sound.binaural.presets')}>
          {FREQUENCY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              className={Math.abs(audio.beat - preset.suggested) < 0.05 ? 'is-active' : ''}
              onClick={() => applyPreset(preset.suggested)}
            >
              {preset.name}
            </button>
          ))}
        </div>
        <Slider
          label={t('sound.binaural.carrier')}
          value={audio.carrier}
          min={100}
          max={500}
          step={1}
          onChange={(carrier) => updateAudio({ carrier })}
          format={(value) => `${Math.round(value)} Hz`}
        />
        <Slider
          label={t('sound.binaural.beat')}
          value={audio.beat}
          min={0.5}
          max={40}
          step={0.1}
          onChange={(beat) => updateAudio({ beat })}
          format={(value) => `${value.toFixed(1)} Hz`}
        />
        <Slider
          label={t('sound.binaural.level')}
          value={audio.binauralVolume}
          min={0}
          max={1}
          step={0.01}
          onChange={(binauralVolume) => updateAudio({ binauralVolume })}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <Toggle
          label={t('sound.binaural.modulation')}
          checked={audio.modulation}
          onChange={(modulation) => updateAudio({ modulation })}
          description={t('sound.binaural.modulationHint')}
        />
        <BinauralCheck />
        <PanelNote tone="warning">{t('sound.binaural.warning')}</PanelNote>
      </PanelSection>

      <PersonalAudioControls />
      <LivingControls />
      <PanelSection title={t('sleep.title')} eyebrow={t('sleep.eyebrow')}>
        <SleepTimerControl />
      </PanelSection>

      <PanelSection
        title={t('sound.mic.title')}
        eyebrow={t('sound.mic.eyebrow')}
        actions={
          <span className={`status-chip ${micStatus === 'active' ? 'is-live' : ''}`.trim()}>
            {micStatus === 'active'
              ? t('sound.mic.live')
              : micStatus === 'requesting'
                ? t('sound.mic.asking')
                : t('sound.mic.off')}
          </span>
        }
      >
        <p className="panel-copy" aria-live="polite">
          {t('sound.mic.copy')}
        </p>
        {micStatus === 'error' && micError ? (
          <PanelNote tone="warning">{micError}</PanelNote>
        ) : null}
        {micStatus === 'active' ? (
          <button
            type="button"
            className="button button--danger-outline"
            onClick={runtime.disableMicrophone}
          >
            <Mic size={15} strokeWidth={1.5} aria-hidden="true" />
            {t('sound.mic.stop')}
          </button>
        ) : (
          <button
            type="button"
            className="button button--outline"
            disabled={!micAvailable || micStatus === 'requesting'}
            onClick={() => void runtime.enableMicrophone()}
          >
            <Mic size={15} strokeWidth={1.5} aria-hidden="true" />
            {micStatus === 'requesting' ? t('sound.mic.requesting') : t('sound.mic.request')}
          </button>
        )}
        {!micAvailable ? (
          <p className="control-hint">{t('sound.mic.unavailable')}</p>
        ) : null}
        <div className="privacy-line">
          <ShieldCheck size={14} strokeWidth={1.4} aria-hidden="true" />
          <span>{t('sound.mic.privacy')}</span>
        </div>
      </PanelSection>
    </PanelShell>
  )
}

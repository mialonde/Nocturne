import { EyeOff, Globe, Keyboard, MonitorUp, RotateCcw, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { getAmbienceSampleCreditRows } from '../../config/ambienceSamples'
import { LANGUAGE_OPTIONS, type LanguageCode } from '../../language/types'
import { useTranslation } from '../../language/useTranslation'
import { useNocturneRuntime } from '../../runtime/NocturneRuntime'
import { useNocturneStore } from '../../store/useNocturneStore'
import type { FullscreenShortcut, QualitySetting } from '../../types'
import { Segmented, SelectField, Slider, Toggle } from '../components/controls'
import { PanelNote, PanelSection } from './PanelSection'
import { PanelShell } from './PanelShell'

const QUALITY_OPTIONS: { value: QualitySetting; label: string; title: string }[] = [
  { value: 'auto', label: 'Auto', title: 'Adapt to measured frame rate' },
  { value: 'high', label: 'High', title: 'Highest detail, heavier GPU load' },
  { value: 'balanced', label: 'Balanced', title: 'Moderate pixel ratio' },
  { value: 'low', label: 'Low', title: 'Lightest rendering' },
]

const SHORTCUT_OPTIONS: { value: FullscreenShortcut; label: string }[] = [
  { value: 'f', label: 'F' },
  { value: 'shift+f', label: 'Shift + F' },
  { value: 'ctrl+shift+f', label: 'Ctrl / Cmd + Shift + F' },
  { value: 'alt+f', label: 'Alt + F' },
]

export function SettingsPanel() {
  const { t } = useTranslation()
  const runtime = useNocturneRuntime()
  const language = useNocturneStore((state) => state.language)
  const setLanguage = useNocturneStore((state) => state.setLanguage)
  const visuals = useNocturneStore((state) => state.visuals)
  const updateVisuals = useNocturneStore((state) => state.updateVisuals)
  const shortcut = useNocturneStore((state) => state.fullscreenShortcut)
  const setShortcut = useNocturneStore((state) => state.setFullscreenShortcut)
  const resetPreferences = useNocturneStore((state) => state.resetPreferences)
  const setUiHidden = useNocturneStore((state) => state.setUiHidden)
  const sessionActive = useNocturneStore((state) => state.sessionPlayback.status !== 'idle')
  const [confirmingReset, setConfirmingReset] = useState(false)
  const shortcutLabel = SHORTCUT_OPTIONS.find((option) => option.value === shortcut)?.label ?? 'F'
  const credits = getAmbienceSampleCreditRows()

  const reset = () => {
    if (sessionActive) runtime.stopSession()
    resetPreferences()
    useNocturneStore.getState().setMode('ambient')
    setConfirmingReset(false)
  }

  return (
    <PanelShell id="settings" title="Settings" eyebrow="Room / interface / access">
      <PanelSection
        title="Visual field"
        eyebrow="Restrained by design"
        actions={
          <span className="section-icon" aria-hidden="true">
            <SlidersHorizontal size={15} strokeWidth={1.4} />
          </span>
        }
      >
        <Segmented
          label="Render quality"
          value={visuals.quality}
          options={QUALITY_OPTIONS}
          onChange={(quality) => updateVisuals({ quality })}
          compact
        />
        <Slider
          label="Particle density"
          value={visuals.particleDensity}
          min={0}
          max={1}
          step={0.01}
          onChange={(particleDensity) => updateVisuals({ particleDensity })}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <Slider
          label="Bloom"
          value={visuals.bloom}
          min={0}
          max={1.5}
          step={0.01}
          onChange={(bloom) => updateVisuals({ bloom })}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <Slider
          label="Contrast"
          value={visuals.contrast}
          min={0.7}
          max={1.4}
          step={0.01}
          onChange={(contrast) => updateVisuals({ contrast })}
          format={(value) => value.toFixed(2)}
        />
        <Slider
          label="Orb intensity"
          value={visuals.intensity}
          min={0.2}
          max={1.4}
          step={0.01}
          onChange={(intensity) => updateVisuals({ intensity })}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <Toggle
          label="Reduced motion"
          checked={visuals.reducedMotion}
          onChange={(reducedMotion) => updateVisuals({ reducedMotion })}
          description="Calms drift, orbit and camera motion. The breathing guide remains readable."
        />
      </PanelSection>

      <PanelSection
        title={t('settings.language.title')}
        eyebrow={t('settings.language.eyebrow')}
        actions={
          <span className="section-icon" aria-hidden="true">
            <Globe size={15} strokeWidth={1.4} />
          </span>
        }
      >
        <SelectField
          label={t('settings.language.select')}
          value={language}
          options={LANGUAGE_OPTIONS.map((opt) => ({
            value: opt.value,
            label: `${opt.nativeName} (${opt.label})`,
          }))}
          onChange={(value) => setLanguage(value as LanguageCode)}
        />
      </PanelSection>

      <PanelSection title="Interface" eyebrow="Leaves no trace in recordings">
        <SelectField
          label="Fullscreen shortcut"
          value={shortcut}
          options={SHORTCUT_OPTIONS}
          onChange={(value) => setShortcut(value as FullscreenShortcut)}
        />
        <div className="button-row">
          <button type="button" className="button button--outline" onClick={() => setUiHidden(true)}>
            <EyeOff size={14} strokeWidth={1.5} aria-hidden="true" />
            Hide interface
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => void runtime.toggleFullscreen()}
          >
            <MonitorUp size={14} strokeWidth={1.5} aria-hidden="true" />
            {runtime.isFullscreen ? 'Leave fullscreen' : 'Enter fullscreen'}
          </button>
        </div>
      </PanelSection>

      <PanelSection
        title="Keyboard"
        eyebrow="When focus is outside a field"
        actions={
          <span className="section-icon" aria-hidden="true">
            <Keyboard size={15} strokeWidth={1.4} />
          </span>
        }
      >
        <dl className="shortcut-list">
          <div>
            <dt>
              <kbd>Space</kbd>
            </dt>
            <dd>Play / pause the room or active session</dd>
          </div>
          <div>
            <dt>
              <kbd>{shortcutLabel}</kbd>
            </dt>
            <dd>Toggle fullscreen</dd>
          </div>
          <div>
            <dt>
              <kbd>H</kbd>
            </dt>
            <dd>Hide or restore this interface</dd>
          </div>
          <div>
            <dt>
              <kbd>Esc</kbd>
            </dt>
            <dd>Close a panel, leave fullscreen, then restore the interface</dd>
          </div>
        </dl>
      </PanelSection>

      <PanelSection title="Privacy" eyebrow="Local by design">
        <div className="privacy-list">
          <p>
            <ShieldCheck size={14} strokeWidth={1.4} aria-hidden="true" />
            No accounts, analytics, uploads or remote audio. Preferences and sessions live in this
            browser's local storage.
          </p>
          <p>
            The microphone is never captured. Recording mixes only the rendered canvas and the
            application's stereo master bus.
          </p>
        </div>
      </PanelSection>

      <PanelSection title="Audio credits" eyebrow="Recorded ambience">
        <div className="credits-list">
          <p className="credits-intro">
            {credits.length > 0 ? t('settings.credits.copy') : t('settings.credits.none')}
          </p>
          {credits.length > 0 ? (
            <ul>
              {credits.map((row) => (
                <li key={row.id}>
                  <span className="credits-track">{row.name}</span>
                  <span className="credits-source">
                    {row.title} — {row.author}
                  </span>
                  <a
                    className="credits-license"
                    href={row.licenseUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {row.license}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </PanelSection>

      <PanelSection title="Known limits" eyebrow="Stated plainly">
        <ul className="limits-list">
          <li>Binaural separation needs headphones; speakers blend both channels.</li>
          <li>Native recording is WebM with VP9/VP8 + Opus where supported. No MP4 without conversion.</li>
          <li>Audio can only begin after an explicit gesture and may be suspended by browser policy.</li>
          <li>Mobile browsers may limit WebGL quality, fullscreen, capture or background playback.</li>
          <li>NOCTURNE is an atmosphere and attention space, not a medical device or treatment.</li>
        </ul>
      </PanelSection>

      <PanelSection title="Reset" eyebrow="Sessions are kept">
        {confirmingReset ? (
          <div className="confirm-strip">
            <span>Return sound, visuals, breathing and recording preferences to their defaults?</span>
            <div>
              <button type="button" className="button button--ghost" onClick={() => setConfirmingReset(false)}>
                Cancel
              </button>
              <button type="button" className="button button--danger-outline" onClick={reset}>
                Reset preferences
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="button button--outline"
            onClick={() => setConfirmingReset(true)}
          >
            <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
            Reset preferences
          </button>
        )}
      </PanelSection>

      <PanelNote>
        NOCTURNE 1.0 · React, Three.js and native Web Audio. No audio or video leaves this tab unless
        you download it.
      </PanelNote>
    </PanelShell>
  )
}

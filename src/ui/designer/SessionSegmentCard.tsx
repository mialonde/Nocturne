import { useMemo } from 'react'
import { ChevronDown, ChevronUp, Headphones, Trash2, Wind } from 'lucide-react'
import {
  AMBIENT_PROFILE_NAMES,
  LADDER_PRESETS,
  computeBinauralPair,
  findLadderPreset,
  formatHz,
} from '../../config/audio'
import { AMBIENCE_SOUND_LIST, AMBIENCE_SOUNDS, PRESET_MIXES, type AmbienceSoundId } from '../../config/ambience'
import { THEMES, THEME_LIST, isThemeId } from '../../config/themes'
import { useNocturneStore } from '../../store/useNocturneStore'
import type { BreathPattern, SessionSegment } from '../../types'
import { NumberField, SelectField, Slider, TextField, Toggle } from '../components/controls'
import { formatLongDuration } from '../format'
import { AutomationControls } from '../features/AutomationControls'

export function SessionSegmentCard({
  segment,
  index,
  selected,
  live,
  canRemove,
  isLast,
  onSelect,
  onChange,
  onMove,
  onRemove,
}: {
  segment: SessionSegment
  index: number
  selected: boolean
  live: boolean
  canRemove: boolean
  isLast: boolean
  onSelect: () => void
  onChange: (patch: Partial<SessionSegment>) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}) {
  const userMixes = useNocturneStore((state) => state.userMixes)
  const pair = computeBinauralPair(segment.carrier, segment.beat)
  const theme = THEMES[segment.theme]
  const ladderValue = segment.ladder
    ? (findLadderPreset(segment.ladder.to)?.id ?? 'custom')
    : 'none'
  const updateBreath = (patch: Partial<BreathPattern>) =>
    onChange({ breathPattern: { ...segment.breathPattern, ...patch } })

  const soundscapeLabel = useMemo(() => {
    const userMix = userMixes.find((m) => m.id === segment.ambientProfile)
    if (userMix) return userMix.name
    const preset = PRESET_MIXES.find((m) => m.id === segment.ambientProfile)
    if (preset) return preset.nameEn || preset.name
    const sound = AMBIENCE_SOUNDS[segment.ambientProfile as AmbienceSoundId]
    if (sound) return sound.nameEn || sound.name
    return AMBIENT_PROFILE_NAMES[segment.ambientProfile as keyof typeof AMBIENT_PROFILE_NAMES] ?? segment.ambientProfile
  }, [segment.ambientProfile, userMixes])

  return (
    <article className={`segment-card ${selected ? 'is-selected' : ''} ${live ? 'is-live' : ''}`.trim()}>
      <div className="segment-card__row">
        <button
          type="button"
          className="segment-card__select"
          aria-expanded={selected}
          aria-controls={`segment-editor-${segment.id}`}
          onClick={onSelect}
        >
          <span className="segment-card__number">{String(index + 1).padStart(2, '0')}</span>
          <span className="segment-card__swatch" style={{ background: theme.swatch }} aria-hidden="true" />
          <span className="segment-card__identity">
            <strong>{segment.label || `Passage ${index + 1}`}</strong>
            <span>
              {formatLongDuration(segment.durationSec)} · {theme.name} · {soundscapeLabel} · {Math.round(segment.carrier)} Hz
              {segment.binaural ? ` / Δ ${formatHz(pair.beat, 1)}` : ''}
              {segment.ladder ? ` → ${formatHz(segment.ladder.to, 1)}` : ''}
            </span>
          </span>
          <span className="segment-card__badges">
            {live ? <span className="segment-badge segment-badge--live">Live</span> : null}
            {segment.binaural ? (
              <span className="segment-badge">
                <Headphones size={11} strokeWidth={1.5} aria-hidden="true" />
                Tone
              </span>
            ) : null}
            {segment.breathing ? (
              <span className="segment-badge">
                <Wind size={11} strokeWidth={1.5} aria-hidden="true" />
                Breath
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={`segment-card__chevron ${selected ? 'is-open' : ''}`.trim()}
            size={15}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>
        <div className="segment-card__actions">
          <button
            type="button"
            aria-label={`Move ${segment.label} earlier`}
            title="Move earlier"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronUp size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${segment.label} later`}
            title="Move later"
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Remove ${segment.label}`}
            title="Remove passage"
            disabled={!canRemove}
            onClick={onRemove}
          >
            <Trash2 size={13} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </div>

      {selected ? (
        <div className="segment-editor" id={`segment-editor-${segment.id}`}>
          <div className="segment-editor__grid">
            <TextField
              label="Passage name"
              value={segment.label}
              maxLength={80}
              onChange={(label) => onChange({ label })}
            />
            <NumberField
              label="Duration"
              value={segment.durationSec}
              min={10}
              max={3600}
              suffix="sec"
              onChange={(durationSec) => onChange({ durationSec })}
            />
          </div>

          <div className="segment-editor__grid segment-editor__grid--three">
            <SelectField
              label="Visual atmosphere"
              value={segment.theme}
              options={THEME_LIST.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(value) => {
                if (!isThemeId(value)) return
                onChange({
                  theme: value,
                  ambientProfile:
                    segment.ambientProfile === segment.theme ? value : segment.ambientProfile,
                })
              }}
            />
            <SelectField
              label="Soundscape"
              value={segment.ambientProfile}
              options={[
                ...THEME_LIST.map((item) => ({
                  value: item.id,
                  label: `Theme · ${AMBIENT_PROFILE_NAMES[item.id]}`,
                })),
                ...AMBIENCE_SOUND_LIST.map((item) => ({
                  value: item.id,
                  label: `${item.category.toUpperCase()} · ${item.nameEn || item.name}`,
                })),
                ...PRESET_MIXES.map((mix) => ({
                  value: mix.id,
                  label: `PRESET · ${mix.nameEn || mix.name}`,
                })),
                ...userMixes.map((mix) => ({
                  value: mix.id,
                  label: `MY MIX · ${mix.name}`,
                })),
              ]}
              onChange={(value) => onChange({ ambientProfile: value })}
            />
            <Slider
              label="Ambient presence"
              value={segment.ambientIntensity}
              min={0}
              max={1}
              step={0.01}
              onChange={(ambientIntensity) => onChange({ ambientIntensity })}
              format={(value) => `${Math.round(value * 100)}%`}
            />
          </div>

          <div className="segment-editor__grid segment-editor__grid--two">
            <Slider
              label="Carrier"
              value={segment.carrier}
              min={100}
              max={500}
              step={1}
              onChange={(carrier) => onChange({ carrier })}
              format={(value) => `${Math.round(value)} Hz`}
            />
            <Slider
              label="Beat difference"
              value={segment.beat}
              min={0.5}
              max={40}
              step={0.1}
              onChange={(beat) => onChange({ beat })}
              format={(value) => formatHz(value, 1)}
            />
          </div>

          <div className="segment-editor__grid segment-editor__grid--two">
            <SelectField
              label="Beat slide"
              value={ladderValue}
              options={[
                { value: 'none', label: 'Steady · no slide' },
                ...LADDER_PRESETS.map((preset) => ({
                  value: preset.id,
                  label: `${preset.nameEn} · ${preset.to} Hz`,
                })),
                ...(ladderValue === 'custom'
                  ? [{ value: 'custom', label: 'Custom' }]
                  : []),
              ]}
              onChange={(value) => {
                if (value === 'none') {
                  onChange({ ladder: null })
                  return
                }
                if (value === 'custom') {
                  onChange({ ladder: { to: segment.ladder?.to ?? segment.beat } })
                  return
                }
                const preset = LADDER_PRESETS.find((item) => item.id === value)
                if (preset) onChange({ ladder: { to: preset.to } })
              }}
            />
            {segment.ladder ? (
              <NumberField
                label="Slide to"
                value={segment.ladder.to}
                min={0.5}
                max={40}
                step={0.5}
                suffix="Hz"
                onChange={(to) => onChange({ ladder: { ...segment.ladder!, to } })}
              />
            ) : null}
          </div>

          {segment.ladder ? (
            <p className="control-hint">
              The beat difference slides from {formatHz(segment.beat, 1)} to{' '}
              {formatHz(segment.ladder.to, 1)} across this passage. The ramp is scheduled in the
              audio thread, so it stays smooth whatever the room is doing.
            </p>
          ) : null}

          <div className="segment-editor__toggles">
            <Toggle
              label="Binaural tone"
              checked={segment.binaural}
              onChange={(binaural) => onChange({ binaural })}
              description={`L ${formatHz(pair.left, 1)} / R ${formatHz(pair.right, 1)}`}
            />
            <Toggle
              label="Guided breathing"
              checked={segment.breathing}
              onChange={(breathing) => onChange({ breathing })}
              description="Starts the breathing rhythm at this passage."
            />
          </div>

          {segment.breathing ? (
            <div className="segment-breath-grid">
              <NumberField
                label="Inhale"
                value={segment.breathPattern.inhale}
                min={1}
                max={60}
                suffix="s"
                onChange={(inhale) => updateBreath({ inhale })}
              />
              <NumberField
                label="Hold"
                value={segment.breathPattern.hold}
                min={0}
                max={60}
                suffix="s"
                onChange={(hold) => updateBreath({ hold })}
              />
              <NumberField
                label="Exhale"
                value={segment.breathPattern.exhale}
                min={1}
                max={60}
                suffix="s"
                onChange={(exhale) => updateBreath({ exhale })}
              />
              <NumberField
                label="Rest"
                value={segment.breathPattern.rest}
                min={0}
                max={60}
                suffix="s"
                onChange={(rest) => updateBreath({ rest })}
              />
            </div>
          ) : null}

          <div className="segment-editor__grid segment-editor__grid--three">
            <NumberField
              label="Fade in"
              value={segment.fadeInSec}
              min={0}
              max={Math.max(0, segment.durationSec)}
              suffix="sec"
              onChange={(fadeInSec) => onChange({ fadeInSec })}
            />
            <NumberField
              label="Fade out"
              value={segment.fadeOutSec}
              min={0}
              max={Math.max(0, segment.durationSec)}
              suffix="sec"
              onChange={(fadeOutSec) => onChange({ fadeOutSec })}
            />
            <NumberField
              label="Transition"
              value={segment.transitionSec}
              min={0}
              max={60}
              suffix="sec"
              onChange={(transitionSec) => onChange({ transitionSec })}
            />
          </div>
          <AutomationControls segment={segment} onChange={onChange} />
          <p className="control-hint">
            Fades shape this passage's volume. Transition sets how slowly tone, atmosphere and
            ambience glide into the next passage.
          </p>
        </div>
      ) : null}
    </article>
  )
}

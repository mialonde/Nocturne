import { useEffect, useState } from 'react'
import { guidanceAvailability, GUIDANCE_PROFILE_IDS, GUIDANCE_PROFILES, type GuidanceProfileId } from '../../config/guidance'
import { useNocturneStore } from '../../store/useNocturneStore'
import { NumberField, SelectField, Slider, Toggle } from '../components/controls'
import { PanelSection } from '../panels/PanelSection'
import { useFeatureCopy } from './copy'
export function GuideControls() {
  const copy = useFeatureCopy()
  const features = useNocturneStore((state) => state.features)
  const update = useNocturneStore((state) => state.updateFeatures)
  const language = useNocturneStore((state) => state.language)
  const [available, setAvailable] = useState<Record<GuidanceProfileId, boolean>>({ sleep: false, focus: false, meditation: false })
  useEffect(() => {
    const controller = new AbortController()
    void guidanceAvailability(controller.signal).then(setAvailable).catch(() => {})
    return () => controller.abort()
  }, [])
  return <PanelSection title={copy.voice}>
    <p className="control-hint">{copy.voiceHint}</p>
    <SelectField label={copy.voice} value={features.voiceProfile}
      options={GUIDANCE_PROFILE_IDS.map((id) => ({ value: id, label: language === 'tr' ? GUIDANCE_PROFILES[id].name : GUIDANCE_PROFILES[id].nameEn }))}
      onChange={(voiceProfile) => update({ voiceProfile: voiceProfile as GuidanceProfileId, voiceEnabled: false })} />
    {!available[features.voiceProfile] ? <p className="control-hint" role="status">{copy.voiceMissing}</p> : null}
    <Toggle label={copy.voiceOn} checked={features.voiceEnabled} disabled={!available[features.voiceProfile] && !features.voiceEnabled}
      onChange={(voiceEnabled) => update({ voiceEnabled })} />
    <Slider label={copy.volume} min={0} max={1} step={0.01} value={features.voiceVolume}
      onChange={(voiceVolume) => update({ voiceVolume })} format={(value) => `${Math.round(value * 100)}%`} />
    <NumberField label={copy.voiceEvery} min={30} max={600} suffix="s" value={features.voiceEverySec}
      onChange={(voiceEverySec) => update({ voiceEverySec })} />
  </PanelSection>
}

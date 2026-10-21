import { useEffect, useState } from 'react'
import { localTurkishVoice } from '../../audio/VoiceGuide'
import { useNocturneStore } from '../../store/useNocturneStore'
import { NumberField, Slider, Toggle } from '../components/controls'
import { PanelSection } from '../panels/PanelSection'
import { useFeatureCopy } from './copy'
export function GuideControls() {
  const copy = useFeatureCopy()
  const features = useNocturneStore((state) => state.features)
  const update = useNocturneStore((state) => state.updateFeatures)
  const [available, setAvailable] = useState(() => Boolean(localTurkishVoice()))
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const refresh = () => setAvailable(Boolean(localTurkishVoice()))
    speechSynthesis.addEventListener('voiceschanged', refresh); refresh()
    return () => speechSynthesis.removeEventListener('voiceschanged', refresh)
  }, [])
  return <PanelSection title={copy.voice}>
    <p className="control-hint">{copy.voiceHint}</p>
    {!available ? <p className="control-hint" role="status">{copy.voiceMissing}</p> : null}
    <Toggle label={copy.voiceOn} checked={features.voiceEnabled} disabled={!available && !features.voiceEnabled}
      onChange={(voiceEnabled) => update({ voiceEnabled })} />
    <Slider label={copy.volume} min={0} max={1} step={0.01} value={features.voiceVolume}
      onChange={(voiceVolume) => update({ voiceVolume })} format={(value) => `${Math.round(value * 100)}%`} />
    <NumberField label={copy.voiceEvery} min={30} max={600} suffix="s" value={features.voiceEverySec}
      onChange={(voiceEverySec) => update({ voiceEverySec })} />
  </PanelSection>
}

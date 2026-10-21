import { useNocturneStore } from '../../store/useNocturneStore'
import { NumberField, Slider, Toggle } from '../components/controls'
import { PanelSection } from '../panels/PanelSection'
import { useFeatureCopy } from './copy'
export function LivingControls() {
  const copy = useFeatureCopy()
  const features = useNocturneStore((state) => state.features)
  const update = useNocturneStore((state) => state.updateFeatures)
  return <PanelSection title={copy.living}>
    <Toggle label={copy.enabled} description={copy.livingHint} checked={features.livingEnabled}
      onChange={(livingEnabled) => update({ livingEnabled })} />
    <Slider label={copy.variation} min={0} max={0.8} step={0.01} value={features.livingVariation}
      onChange={(livingVariation) => update({ livingVariation })} format={(value) => `${Math.round(value * 100)}%`} />
    <NumberField label={copy.interval} min={10} max={180} suffix="s" value={features.livingEverySec}
      onChange={(livingEverySec) => update({ livingEverySec })} />
    <NumberField label={copy.seed} min={1} max={2147483647} value={features.livingSeed}
      onChange={(livingSeed) => update({ livingSeed })} />
  </PanelSection>
}

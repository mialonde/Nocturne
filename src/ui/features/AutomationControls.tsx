import type { PassageAutomation, SessionSegment } from '../../types'
import { Slider, Toggle } from '../components/controls'
import { useFeatureCopy } from './copy'

export function AutomationControls({ segment, onChange }: {
  segment: SessionSegment; onChange: (patch: Partial<SessionSegment>) => void
}) {
  const copy = useFeatureCopy()
  const value = segment.automation
  const update = (patch: Partial<PassageAutomation>) => {
    if (value) onChange({ automation: { ...value, ...patch } })
  }
  return <div>
    <Toggle label={copy.automation} description={copy.automationHint} checked={Boolean(value)} onChange={(enabled) =>
      onChange({ automation: enabled ? { visualIntensityTo: 0.3, bloomTo: 0.2, ambientTo: 0.25, cameraMotionTo: 0.2 } : undefined })} />
    {value ? <div className="segment-editor__grid">
      <Slider label={copy.intensity} min={0.2} max={1.4} step={0.01} value={value.visualIntensityTo}
        onChange={(visualIntensityTo) => update({ visualIntensityTo })} />
      <Slider label={copy.bloom} min={0} max={1.5} step={0.01} value={value.bloomTo}
        onChange={(bloomTo) => update({ bloomTo })} />
      <Slider label={copy.ambient} min={0} max={1} step={0.01} value={value.ambientTo}
        onChange={(ambientTo) => update({ ambientTo })} />
      <Slider label={copy.camera} min={0} max={2} step={0.01} value={value.cameraMotionTo}
        onChange={(cameraMotionTo) => update({ cameraMotionTo })} />
    </div> : null}
  </div>
}

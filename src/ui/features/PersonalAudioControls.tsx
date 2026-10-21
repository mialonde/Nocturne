import { useEffect, useState } from 'react'
import { useNocturneRuntime } from '../../runtime/NocturneRuntime'
import { useNocturneStore } from '../../store/useNocturneStore'
import { MAX_PERSONAL_AUDIO_BYTES, readPersonalAudio, writePersonalAudio } from '../../storage/personalAudio'
import { Slider, Toggle } from '../components/controls'
import { PanelSection } from '../panels/PanelSection'
import { useFeatureCopy } from './copy'
import { useCaptureBusy } from './useCaptureBusy'

export function PersonalAudioControls() {
  const copy = useFeatureCopy()
  const runtime = useNocturneRuntime()
  const features = useNocturneStore((state) => state.features)
  const update = useNocturneStore((state) => state.updateFeatures)
  const captureBusy = useCaptureBusy()
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void readPersonalAudio().then((file) => { if (active) setName(file?.name ?? '') }).catch(() => {})
    return () => { active = false }
  }, [])
  const choose = async (file: File) => {
    setBusy(true); setError('')
    try {
      if (!file.size || file.size > MAX_PERSONAL_AUDIO_BYTES) throw new Error('Maximum audio file size: 20 MB.')
      await runtime.beginExperience()
      await runtime.audio.loadPersonalAudio(file)
      try { await writePersonalAudio({ name: file.name, blob: file }) } catch (cause) {
        runtime.audio.clearPersonalAudio()
        throw cause
      }
      setName(file.name)
      update({ personalEnabled: true })
      useNocturneStore.getState().showToast(copy.loaded, 'quiet')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Audio could not load.') }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try {
      await writePersonalAudio(null)
      runtime.audio.clearPersonalAudio()
      update({ personalEnabled: false })
      setName(''); setError('')
    } catch (cause) { setError(String(cause)) } finally { setBusy(false) }
  }
  return (
    <PanelSection title={copy.personal}>
      <p className="control-hint">{copy.personalHint}</p>
      <label className="field-label">{copy.choose}
        <input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.webm" disabled={busy || captureBusy}
          onChange={(event) => {
            const file = event.target.files?.[0]; event.target.value = ''
            if (file) void choose(file)
          }} />
      </label>
      <p className="control-hint">{name || copy.noAudio}</p>
      {error ? <p role="alert" className="control-hint">{error}</p> : null}
      <Toggle label={copy.enabled} checked={features.personalEnabled} disabled={!name || busy}
        onChange={(personalEnabled) => update({ personalEnabled })} />
      <Slider label={copy.volume} min={0} max={1} step={0.01} value={features.personalVolume}
        onChange={(personalVolume) => update({ personalVolume })} format={(value) => `${Math.round(value * 100)}%`} />
      <Slider label={copy.pan} min={-1} max={1} step={0.01} value={features.personalPan}
        onChange={(personalPan) => update({ personalPan })}
        format={(value) => Math.abs(value) < 0.01 ? copy.center : `${value < 0 ? copy.left : copy.right} ${Math.round(Math.abs(value) * 100)}%`} />
      {name ? <button type="button" className="button button--ghost" disabled={busy || captureBusy} onClick={() => void remove()}>{copy.remove}</button> : null}
    </PanelSection>
  )
}

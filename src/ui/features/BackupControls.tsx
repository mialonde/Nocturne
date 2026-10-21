import { useState } from 'react'
import { useNocturneRuntime } from '../../runtime/NocturneRuntime'
import { useNocturneStore } from '../../store/useNocturneStore'
import { getBackupPreferences, MAX_BACKUP_BYTES, parseBackup, serializeBackup } from '../../storage/backup'
import { readPersonalAudio, writePersonalAudio } from '../../storage/personalAudio'
import { PanelSection } from '../panels/PanelSection'
import { useFeatureCopy } from './copy'
import { useCaptureBusy } from './useCaptureBusy'

export function BackupControls() {
  const copy = useFeatureCopy()
  const runtime = useNocturneRuntime()
  const captureBusy = useCaptureBusy()
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<ReturnType<typeof parseBackup> | null>(null)
  const [error, setError] = useState('')
  const save = async () => {
    setBusy(true); setError('')
    try {
      const raw = await serializeBackup(useNocturneStore.getState(), await readPersonalAudio())
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url; link.download = `nocturne-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) { setError(String(cause)) } finally { setBusy(false) }
  }
  const inspect = async (file: File) => {
    setBusy(true); setError(''); setPending(null)
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Maximum backup size: 32 MB.')
      setPending(parseBackup(await file.text(), getBackupPreferences(useNocturneStore.getState())))
    } catch (cause) { setError(String(cause)) } finally { setBusy(false) }
  }
  const restore = async () => {
    if (!pending || captureBusy) return
    setBusy(true); setError('')
    try {
      // Persist the largest item first; a quota failure leaves preferences untouched.
      await writePersonalAudio(pending.audioFile)
      runtime.stopAll()
      runtime.audio.clearPersonalAudio()
      useNocturneStore.setState({ ...pending.preferences, mode: 'ambient', breathRunning: false,
        sleepTimer: { endsAt: null, minutes: null, remainingMs: 0 } })
      setPending(null)
      useNocturneStore.getState().showToast(copy.done, 'quiet')
    } catch (cause) { setError(String(cause)) } finally { setBusy(false) }
  }
  return (
    <PanelSection title={copy.backup}>
      <p className="control-hint">{copy.backupHint}</p>
      <div className="button-row">
        <button type="button" className="button button--outline" disabled={busy || captureBusy} onClick={() => void save()}>{copy.export}</button>
      </div>
      <label className="field-label">{copy.import}
        <input type="file" accept="application/json,.json" disabled={busy || captureBusy} onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = ''
          if (file) void inspect(file)
        }} />
      </label>
      {pending ? <div className="confirm-strip">
        <span>{copy.preview}: {pending.preferences.sessions.length} seans / sessions, {pending.preferences.userMixes.length} mixes{pending.audioFile ? ` · ${pending.audioFile.name}` : ''}</span>
        <div className="button-row">
          <button className="button button--danger-outline" type="button" disabled={busy || captureBusy} onClick={() => void restore()}>{copy.restore}</button>
          <button className="button button--ghost" type="button" disabled={busy} onClick={() => setPending(null)}>{copy.cancel}</button>
        </div>
      </div> : null}
      {error ? <p className="control-hint" role="alert">{error}</p> : null}
    </PanelSection>
  )
}

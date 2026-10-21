import { useRef, useState } from 'react'
import {
  Clock,
  Copy,
  Download,
  Layers,
  Plus,
  Play,
  Save,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  createEmptySegment,
  createSegmentId,
  normalizeSegments,
  totalSessionDuration,
} from '../../config/sessions'
import { THEMES } from '../../config/themes'
import { useNocturneRuntime } from '../../runtime/NocturneRuntime'
import { parseSessionFile, serializeSession } from '../../session/sessionFile'
import { useNocturneStore } from '../../store/useNocturneStore'
import type { SavedSession, SessionSegment } from '../../types'
import { formatLongDuration } from '../format'
import { PanelShell } from '../panels/PanelShell'
import { SessionSegmentCard } from './SessionSegmentCard'
import { cloneSessionDraft, createSessionDraft, slugifySessionName } from './sessionDraft'

type PendingChange = { kind: 'load'; session: SavedSession } | { kind: 'new' } | null

export function SessionDesigner() {
  const runtime = useNocturneRuntime()
  const sessions = useNocturneStore((state) => state.sessions)
  const addSession = useNocturneStore((state) => state.addSession)
  const updateSession = useNocturneStore((state) => state.updateSession)
  const deleteSession = useNocturneStore((state) => state.deleteSession)
  const showToast = useNocturneStore((state) => state.showToast)
  const playbackStatus = useNocturneStore((state) => state.sessionPlayback.status)
  const playbackSessionId = useNocturneStore((state) => state.sessionPlayback.sessionId)
  const playbackSegmentIndex = useNocturneStore((state) => state.sessionPlayback.segmentIndex)
  const initialSession = sessions[0]
  const [draft, setDraft] = useState<SavedSession>(() =>
    initialSession ? cloneSessionDraft(initialSession) : createSessionDraft(),
  )
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('')
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState<PendingChange>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [starting, setStarting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const segments = draft.segments
  const effectiveSelectedId = segments.some((segment) => segment.id === selectedSegmentId)
    ? selectedSegmentId
    : (segments[0]?.id ?? '')
  const persisted = sessions.some((session) => session.id === draft.id)
  const durationSec = totalSessionDuration(segments) / 1000
  const sessionIsLive = playbackStatus !== 'idle' && playbackSessionId === draft.id

  const patchDraft = (patch: Partial<SavedSession>) => {
    setDraft((current) => ({ ...current, ...patch, updatedAt: Date.now() }))
    setDirty(true)
  }

  const patchSegment = (segmentId: string, patch: Partial<SessionSegment>) => {
    setDraft((current) => ({
      ...current,
      updatedAt: Date.now(),
      segments: current.segments.map((segment) =>
        segment.id === segmentId ? { ...segment, ...patch } : segment,
      ),
    }))
    setDirty(true)
  }

  const loadSession = (session: SavedSession) => {
    const copy = cloneSessionDraft(session)
    setDraft(copy)
    setSelectedSegmentId(copy.segments[0]?.id ?? '')
    setDirty(false)
    setPending(null)
    setConfirmDelete(false)
  }

  const requestLoad = (session: SavedSession) => {
    if (session.id === draft.id) return
    if (dirty) {
      setPending({ kind: 'load', session })
      return
    }
    loadSession(session)
  }

  const requestNew = () => {
    if (dirty) {
      setPending({ kind: 'new' })
      return
    }
    loadSession(createSessionDraft())
  }

  const resolvePending = (discard: boolean) => {
    if (!pending) return
    if (!discard) {
      setPending(null)
      return
    }
    if (pending.kind === 'load') loadSession(pending.session)
    else loadSession(createSessionDraft())
  }

  const addSegment = () => {
    const currentIndex = segments.findIndex((segment) => segment.id === effectiveSelectedId)
    const base = segments[currentIndex] ?? segments[segments.length - 1]
    const segment = createEmptySegment({
      label: `Passage ${segments.length + 1}`,
      durationSec: 180,
      carrier: base?.carrier ?? 200,
      beat: base?.beat ?? 10,
      theme: base?.theme ?? 'dusk',
      ambientProfile: base?.ambientProfile ?? 'dusk',
      ambientIntensity: base?.ambientIntensity ?? 0.5,
      binaural: base?.binaural ?? true,
      breathing: false,
      fadeInSec: 0,
      fadeOutSec: 0,
      transitionSec: base?.transitionSec ?? 6,
    })
    const insertAt = currentIndex >= 0 ? currentIndex + 1 : segments.length
    setDraft((current) => {
      const next = [...current.segments]
      next.splice(insertAt, 0, segment)
      return { ...current, updatedAt: Date.now(), segments: next }
    })
    setSelectedSegmentId(segment.id)
    setDirty(true)
  }

  const removeSegment = (segmentId: string) => {
    if (segments.length <= 1) return
    const index = segments.findIndex((segment) => segment.id === segmentId)
    const next = segments.filter((segment) => segment.id !== segmentId)
    setDraft((current) => ({
      ...current,
      updatedAt: Date.now(),
      segments: current.segments.filter((segment) => segment.id !== segmentId),
    }))
    const nextSelection = next[Math.max(0, index - 1)] ?? next[0]
    setSelectedSegmentId(nextSelection?.id ?? '')
    setDirty(true)
  }

  const moveSegment = (segmentId: string, direction: -1 | 1) => {
    const index = segments.findIndex((segment) => segment.id === segmentId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= segments.length) return
    setDraft((current) => {
      const next = [...current.segments]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return { ...current, updatedAt: Date.now(), segments: next }
    })
    setDirty(true)
  }

  const saveDraft = (): SavedSession | null => {
    const cleanName = draft.name.trim() || 'Untitled descent'
    const saved: SavedSession = {
      ...draft,
      name: cleanName,
      note: draft.note.trim(),
      segments: normalizeSegments(draft.segments),
      updatedAt: Date.now(),
    }
    if (persisted) {
      updateSession(saved.id, {
        name: saved.name,
        note: saved.note,
        segments: saved.segments,
      })
      setDraft(saved)
      setDirty(false)
      setConfirmDelete(false)
      showToast('Session saved in this browser.', 'quiet')
      return saved
    }
    const created: SavedSession = {
      ...saved,
      createdAt: Date.now(),
    }
    addSession(created)
    setDraft(created)
    setDirty(false)
    setConfirmDelete(false)
    setSelectedSegmentId(created.segments[0]?.id ?? '')
    showToast('New session saved in this browser.', 'quiet')
    return created
  }

  const saveAsCopy = () => {
    const normalized = normalizeSegments(draft.segments).map((segment) => ({
      ...segment,
      id: createSegmentId(),
    }))
    const now = Date.now()
    const copy: SavedSession = {
      ...draft,
      id: `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${draft.name.trim() || 'Untitled descent'} · variation`.slice(0, 80),
      segments: normalized,
      createdAt: now,
      updatedAt: now,
    }
    addSession(copy)
    setDraft(copy)
    setSelectedSegmentId(copy.segments[0]?.id ?? '')
    setDirty(false)
    setPending(null)
    showToast('A named variation has been saved.', 'quiet')
  }

  const exportDraft = () => {
    const normalized: SavedSession = {
      ...draft,
      segments: normalizeSegments(draft.segments),
      updatedAt: Date.now(),
    }
    try {
      const blob = new Blob([serializeSession(normalized)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${slugifySessionName(draft.name)}.nocturne.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      showToast('Session exported as a NOCTURNE JSON file.', 'quiet')
    } catch {
      showToast('The session could not be exported.', 'warning')
    }
  }

  const importFile = async (file: File) => {
    if (file.size > 1_500_000) {
      showToast('That session file is too large to import.', 'warning')
      return
    }
    try {
      const imported = parseSessionFile(await file.text())
      addSession(imported)
      if (dirty) {
        setPending({ kind: 'load', session: imported })
      } else {
        loadSession(imported)
      }
      showToast(`Imported “${imported.name}”.`, 'quiet')
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'The session file could not be read.',
        'error',
      )
    }
  }

  const deleteCurrent = () => {
    if (sessionIsLive) runtime.stopSession()
    const remaining = sessions.filter((session) => session.id !== draft.id)
    if (persisted) deleteSession(draft.id)
    setConfirmDelete(false)
    setPending(null)
    if (remaining[0]) {
      loadSession(remaining[0])
    } else {
      loadSession(createSessionDraft())
    }
    showToast(persisted ? 'Session deleted.' : 'Draft discarded.', 'quiet')
  }

  const begin = async () => {
    if (segments.length === 0) return
    setStarting(true)
    try {
      await runtime.startSession({
        ...draft,
        name: draft.name.trim() || 'Untitled descent',
        segments: normalizeSegments(segments),
      })
    } finally {
      setStarting(false)
    }
  }

  return (
    <PanelShell
      id="session"
      title="Session designer"
      eyebrow="Segments / transitions / local exchange"
      wide
      actions={
        <span className={`status-chip ${dirty ? 'is-live' : ''}`.trim()}>
          {dirty ? 'Unsaved' : persisted ? 'Saved' : 'Draft'}
        </span>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void importFile(file)
        }}
      />

      <div className="designer">
        <aside className="designer__sidebar">
          <div className="designer__sidebar-head">
            <div>
              <p className="panel-section__eyebrow">Local library</p>
              <h3>Sessions</h3>
            </div>
            <button
              type="button"
              className="icon-button icon-button--small"
              aria-label="New session"
              title="New session"
              onClick={requestNew}
            >
              <Plus size={15} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </div>
          <div className="session-library">
            {sessions.length === 0 ? (
              <p className="designer__empty">No saved sessions yet. Build one and press Save.</p>
            ) : (
              sessions.map((session) => {
                const active = session.id === draft.id
                return (
                  <button
                    type="button"
                    key={session.id}
                    className={`session-library__item ${active ? 'is-active' : ''}`.trim()}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => requestLoad(session)}
                  >
                    <span className="session-library__name">{session.name}</span>
                    <span className="session-library__meta">
                      {formatLongDuration(totalSessionDuration(session.segments) / 1000)} ·{' '}
                      {session.segments.length} passages
                    </span>
                    <span className="session-library__line" aria-hidden="true" />
                  </button>
                )
              })
            )}
          </div>
          <button type="button" className="designer__new-button" onClick={requestNew}>
            <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
            New session
          </button>
          <p className="designer__storage-note">
            Stored in this browser. Export a JSON file to keep a session elsewhere.
          </p>
        </aside>

        <div className="designer__main">
          {pending ? (
            <div className="designer-pending" role="status">
              <span>You have unsaved edits in this session.</span>
              <div>
                <button type="button" className="button button--ghost" onClick={() => resolvePending(false)}>
                  Keep editing
                </button>
                <button type="button" className="button button--danger-outline" onClick={() => resolvePending(true)}>
                  Discard and continue
                </button>
              </div>
            </div>
          ) : null}

          <div className="designer__title-block">
            <div className="designer__title-row">
              <input
                className="designer__name"
                aria-label="Session name"
                value={draft.name}
                maxLength={80}
                onChange={(event) => patchDraft({ name: event.target.value })}
              />
              <div className="designer__toolbar">
                <button
                  type="button"
                  className="toolbar-button"
                  disabled={!dirty && persisted}
                  onClick={saveDraft}
                  title="Save session"
                >
                  <Save size={14} strokeWidth={1.5} aria-hidden="true" />
                  <span>{dirty ? 'Save' : 'Saved'}</span>
                </button>
                <button type="button" className="toolbar-button" onClick={saveAsCopy} title="Save a named copy">
                  <Copy size={14} strokeWidth={1.5} aria-hidden="true" />
                  <span>Save copy</span>
                </button>
                <button type="button" className="toolbar-button" onClick={exportDraft} title="Export JSON">
                  <Download size={14} strokeWidth={1.5} aria-hidden="true" />
                  <span>Export</span>
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Import JSON"
                >
                  <Upload size={14} strokeWidth={1.5} aria-hidden="true" />
                  <span>Import</span>
                </button>
                <button
                  type="button"
                  className="toolbar-button toolbar-button--quiet"
                  onClick={() => setConfirmDelete(true)}
                  title={persisted ? 'Delete this session' : 'Discard this draft'}
                >
                  <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                  <span>{persisted ? 'Delete' : 'Discard'}</span>
                </button>
              </div>
            </div>
            <textarea
              className="designer__note"
              aria-label="Session note"
              rows={2}
              maxLength={400}
              value={draft.note}
              placeholder="A note about this sequence"
              onChange={(event) => patchDraft({ note: event.target.value })}
            />
            <div className="designer__meta">
              <span>
                <Clock size={13} strokeWidth={1.4} aria-hidden="true" />
                {formatLongDuration(durationSec)}
              </span>
              <span>
                <Layers size={13} strokeWidth={1.4} aria-hidden="true" />
                {segments.length} {segments.length === 1 ? 'passage' : 'passages'}
              </span>
              {sessionIsLive ? <span className="designer__live">Currently running</span> : null}
            </div>
          </div>

          {confirmDelete ? (
            <div className="confirm-strip">
              <span>
                {persisted
                  ? `Delete “${draft.name}” from this browser?`
                  : `Discard the unsaved draft “${draft.name}”?`}
              </span>
              <div>
                <button type="button" className="button button--ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
                <button type="button" className="button button--danger-outline" onClick={deleteCurrent}>
                  {persisted ? 'Delete session' : 'Discard draft'}
                </button>
              </div>
            </div>
          ) : null}

          <div className="designer__timeline" aria-label="Session timeline">
            {segments.map((segment, index) => {
              const theme = THEMES[segment.theme]
              return (
                <button
                  type="button"
                  key={segment.id}
                  className={`timeline-segment ${segment.id === effectiveSelectedId ? 'is-selected' : ''} ${
                    playbackStatus !== 'idle' &&
                    playbackSessionId === draft.id &&
                    playbackSegmentIndex === index
                      ? 'is-live'
                      : ''
                  }`.trim()}
                  style={{
                    flexGrow: Math.max(8, segment.durationSec),
                    background: `linear-gradient(135deg, ${theme.palette.backgroundAccent}, ${theme.swatch})`,
                  }}
                  title={`${segment.label} · ${formatLongDuration(segment.durationSec)}`}
                  onClick={() => setSelectedSegmentId(segment.id)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{segment.label}</strong>
                </button>
              )
            })}
          </div>

          <div className="designer__segments">
            {segments.map((segment, index) => (
              <SessionSegmentCard
                key={segment.id}
                segment={segment}
                index={index}
                selected={segment.id === effectiveSelectedId}
                live={
                  playbackStatus !== 'idle' &&
                  playbackSessionId === draft.id &&
                  playbackSegmentIndex === index
                }
                canRemove={segments.length > 1}
                isLast={index === segments.length - 1}
                onSelect={() => setSelectedSegmentId(segment.id)}
                onChange={(patch) => patchSegment(segment.id, patch)}
                onMove={(direction) => moveSegment(segment.id, direction)}
                onRemove={() => removeSegment(segment.id)}
              />
            ))}
          </div>

          <button type="button" className="designer__add-passage" onClick={addSegment}>
            <Plus size={15} strokeWidth={1.5} aria-hidden="true" />
            Add passage
          </button>

          <div className="designer__begin">
            <div>
              <p className="panel-section__eyebrow">Preview this draft</p>
              <strong>{formatLongDuration(durationSec)} of continuous transition</strong>
              <span>Unsaved edits are used for the preview. Close the workspace to watch it alone.</span>
            </div>
            <div className="designer__begin-actions">
              {sessionIsLive ? (
                <button type="button" className="button button--ghost" onClick={runtime.stopSession}>
                  <Square size={12} strokeWidth={1.5} aria-hidden="true" />
                  End session
                </button>
              ) : null}
              <button
                type="button"
                className="button button--primary"
                disabled={starting || segments.length === 0}
                onClick={() => void begin()}
              >
                <Play size={14} strokeWidth={1.5} aria-hidden="true" />
                {starting ? 'Opening…' : sessionIsLive ? 'Restart session' : 'Begin session'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="designer__footer-note">
        Imported and exported sessions are self-contained JSON files. The library remains local to
        this browser.
      </p>
    </PanelShell>
  )
}

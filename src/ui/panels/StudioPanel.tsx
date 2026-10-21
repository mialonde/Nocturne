import { useEffect, useRef } from 'react'
import {
  AudioLines,
  CircleStop,
  Clapperboard,
  Download,
  LoaderCircle,
  Pause,
  Play,
  ShieldCheck,
  Trash2,
  Video,
} from 'lucide-react'
import type { RecordingAspect, RecordingQuality } from '../../types'
import { useNocturneRuntime } from '../../runtime/NocturneRuntime'
import { useNocturneStore } from '../../store/useNocturneStore'
import { Segmented, Toggle } from '../components/controls'
import { formatBytes, formatDurationMs } from '../format'
import { useRecordingSnapshot } from '../hooks/useRecordingSnapshot'
import { PanelNote, PanelSection } from './PanelSection'
import { PanelShell } from './PanelShell'

const ASPECTS: { value: RecordingAspect; label: string }[] = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
]

const RESOLUTIONS = [
  { value: 720 as const, label: '720p' },
  { value: 1080 as const, label: '1080p' },
  { value: 1440 as const, label: '1440p' },
]

const QUALITIES: { value: RecordingQuality; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'compact', label: 'Compact' },
]

export function StudioPanel() {
  const runtime = useNocturneRuntime()
  const settings = useNocturneStore((state) => state.recording)
  const updateRecording = useNocturneStore((state) => state.updateRecording)
  const snapshot = useRecordingSnapshot(runtime.recording)
  const support = runtime.recording.getSupport(settings.includeAudio)
  const busy =
    snapshot.phase === 'preparing' ||
    snapshot.phase === 'recording' ||
    snapshot.phase === 'paused' ||
    snapshot.phase === 'processing'
  const result = snapshot.result
  const takeRef = useRef<HTMLDivElement | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)

  // The profile controls are tall. Bring the live controls or the finished
  // take into view when the take moves between phases, so Pause/Resume/End
  // and Download never sit below the fold.
  useEffect(() => {
    if (
      snapshot.phase === 'preparing' ||
      snapshot.phase === 'recording' ||
      snapshot.phase === 'paused' ||
      snapshot.phase === 'error' ||
      snapshot.phase === 'ready'
    ) {
      takeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [snapshot.phase])

  useEffect(() => {
    if (snapshot.phase === 'ready' && result) {
      resultRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [result, snapshot.phase])

  return (
    <PanelShell
      id="studio"
      title="Studio"
      eyebrow="Canvas + master audio / one file"
      actions={
        <span
          className={`status-chip ${snapshot.phase === 'recording' ? 'is-live' : ''} ${
            snapshot.phase === 'error' ? 'is-error' : ''
          }`.trim()}
        >
          {snapshot.phase === 'recording'
            ? 'Recording'
            : snapshot.phase === 'paused'
              ? 'Paused'
              : snapshot.phase === 'preparing'
                ? 'Preparing'
                : snapshot.phase === 'processing'
                  ? 'Sealing'
                  : snapshot.phase === 'ready'
                    ? 'Ready'
                    : snapshot.phase === 'error'
                      ? 'Error'
                      : support.supported
                        ? 'Available'
                        : 'Unavailable'}
        </span>
      }
    >
      <PanelSection
        title="Capture profile"
        eyebrow="Native browser encoder"
        actions={
          <span className="section-icon" aria-hidden="true">
            <Clapperboard size={15} strokeWidth={1.4} />
          </span>
        }
      >
        <div className="studio-format">
          <div>
            <span>Detected format</span>
            <strong>{support.label}</strong>
          </div>
          <div>
            <span>Destination</span>
            <strong>
              {settings.resolution}p · {settings.fps} fps
            </strong>
          </div>
        </div>
        <Segmented
          label="Frame"
          value={settings.aspect}
          options={ASPECTS}
          onChange={(aspect) => updateRecording({ aspect })}
          disabled={busy}
          compact
        />
        <Segmented
          label="Resolution"
          value={settings.resolution}
          options={RESOLUTIONS}
          onChange={(resolution) => updateRecording({ resolution })}
          disabled={busy}
          compact
        />
        <Segmented
          label="Frame rate"
          value={settings.fps}
          options={[
            { value: 30 as const, label: '30 fps' },
            { value: 60 as const, label: '60 fps' },
          ]}
          onChange={(fps) => updateRecording({ fps })}
          disabled={busy}
          compact
        />
        <Segmented
          label="Quality"
          value={settings.quality}
          options={QUALITIES}
          onChange={(quality) => updateRecording({ quality })}
          disabled={busy}
          compact
        />
        <Toggle
          label="Include stereo master audio"
          checked={settings.includeAudio}
          onChange={(includeAudio) => updateRecording({ includeAudio })}
          description="The same post-limiter signal you hear, including ambience, binaural tones and cues."
          disabled={busy}
        />
        <Toggle
          label="Clean capture"
          checked={settings.cleanCapture}
          onChange={(cleanCapture) => updateRecording({ cleanCapture })}
          description="Excludes every interface element. Off adds only a small baked-in frequency stamp."
          disabled={busy}
        />
        <PanelNote>
          Video is rendered again into an offscreen WebGL canvas at the chosen frame. The visible
          interface is never part of the file.
        </PanelNote>
      </PanelSection>

      <PanelSection title="Take" eyebrow="Synchronized start">
        <div ref={takeRef}>
          {!support.supported && support.reason ? (
            <PanelNote tone="warning">{support.reason}</PanelNote>
          ) : null}
          {snapshot.error ? <PanelNote tone="warning">{snapshot.error}</PanelNote> : null}
          {snapshot.notice ? <PanelNote>{snapshot.notice}</PanelNote> : null}

          {snapshot.phase === 'recording' || snapshot.phase === 'paused' ? (
          <div className="recording-live-card">
            <div className="recording-live-card__status">
              <span className="recording-live-card__dot" aria-hidden="true" />
              <div>
                <span>{snapshot.phase === 'paused' ? 'Recording paused' : 'Recording now'}</span>
                <strong>{formatDurationMs(snapshot.elapsedMs)}</strong>
              </div>
            </div>
            <div className="recording-live-card__meta">
              {snapshot.width}×{snapshot.height} · {snapshot.fps} fps · {formatBytes(snapshot.bytes)}
            </div>
            <div className="button-row">
              <button
                type="button"
                className="button button--outline"
                disabled={!snapshot.pausedSupported}
                onClick={() => {
                  if (snapshot.phase === 'paused') runtime.recording.resume()
                  else runtime.recording.pause()
                }}
              >
                {snapshot.phase === 'paused' ? (
                  <Play size={14} strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <Pause size={14} strokeWidth={1.5} aria-hidden="true" />
                )}
                {snapshot.phase === 'paused' ? 'Resume' : 'Pause'}
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => runtime.recording.stop()}
              >
                <CircleStop size={15} strokeWidth={1.5} aria-hidden="true" />
                End take
              </button>
            </div>
            {!snapshot.pausedSupported ? (
              <p className="control-hint">This browser cannot pause a MediaRecorder stream.</p>
            ) : null}
          </div>
        ) : snapshot.phase === 'preparing' ? (
          <div className="recording-preparing">
            <LoaderCircle className="spin" size={18} strokeWidth={1.4} aria-hidden="true" />
            <span>Opening the offscreen capture surface and priming the encoder…</span>
          </div>
        ) : snapshot.phase === 'processing' ? (
          <div className="recording-preparing">
            <LoaderCircle className="spin" size={18} strokeWidth={1.4} aria-hidden="true" />
            <span>Sealing the WebM file. This can take a few seconds.</span>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="button button--primary button--record"
              disabled={!support.supported || busy || !runtime.environment}
              onClick={() => void runtime.startRecording()}
            >
              <span className="record-dot" aria-hidden="true" />
              {result ? 'Record another take' : 'Begin recording'}
            </button>
            <p className="control-hint">
              If sound is paused, it begins with the take. A running session keeps its own timeline.
            </p>
          </>
        )}

          <div className="studio-compatibility">
            <div>
              <AudioLines size={14} strokeWidth={1.4} aria-hidden="true" />
              <span>{settings.includeAudio ? 'Stereo audio attached' : 'Silent video'}</span>
            </div>
            <div>
              <ShieldCheck size={14} strokeWidth={1.4} aria-hidden="true" />
              <span>No microphone</span>
            </div>
            <div>
              <Video size={14} strokeWidth={1.4} aria-hidden="true" />
              <span>WebM / {snapshot.formatLabel || support.label}</span>
            </div>
          </div>
        </div>
      </PanelSection>

      {result ? (
        <PanelSection title="Last take" eyebrow="Local preview">
          <div ref={resultRef}>
            <div className="recording-preview">
              <video src={result.url} controls playsInline preload="metadata" />
            </div>
            <div className="result-meta">
              <span>
                {result.width}×{result.height}
              </span>
              <span>{formatDurationMs(result.durationMs)}</span>
              <span>{formatBytes(result.bytes)}</span>
              <span>{result.hasAudio ? 'Stereo' : 'Silent'}</span>
            </div>
            <p className="result-file">{result.fileName}</p>
            <div className="button-row">
              <button type="button" className="button button--primary" onClick={() => runtime.recording.download()}>
                <Download size={15} strokeWidth={1.5} aria-hidden="true" />
                Download WebM
              </button>
              <button type="button" className="button button--ghost" onClick={() => runtime.recording.discardResult()}>
                <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                Discard
              </button>
            </div>
          </div>
        </PanelSection>
      ) : null}

      <PanelNote tone="warning">
        NOCTURNE records native WebM only. There is no MP4 or FFmpeg step. Sharing to services that
        require MP4 may need a separate conversion. Files stay in this tab until downloaded or discarded.
      </PanelNote>
    </PanelShell>
  )
}

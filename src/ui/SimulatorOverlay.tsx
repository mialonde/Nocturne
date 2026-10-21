import { useEffect, useRef, useState } from 'react'
import {
  Compass,
  LogOut,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useNocturneRuntime } from '../runtime/NocturneRuntime'
import { useNocturneStore } from '../store/useNocturneStore'
import { ThemeMenu } from './ThemeMenu'

export function SimulatorOverlay() {
  const runtime = useNocturneRuntime()
  const theme = useNocturneStore((state) => state.theme)
  const setTheme = useNocturneStore((state) => state.setTheme)
  const audio = useNocturneStore((state) => state.audio)
  const updateAudio = useNocturneStore((state) => state.updateAudio)
  const visuals = useNocturneStore((state) => state.visuals)
  const updateVisuals = useNocturneStore((state) => state.updateVisuals)
  const audioStatus = useNocturneStore((state) => state.audioStatus)
  const isPlaying = audioStatus === 'playing'

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [autoDrift, setAutoDriftState] = useState(true)
  const [isIdle, setIsIdle] = useState(false)
  const idleTimerRef = useRef<number | null>(null)

  // Auto-hide controls during immersion when idle for 4.5 seconds
  useEffect(() => {
    const resetIdle = () => {
      setIsIdle(false)
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
      }
      idleTimerRef.current = window.setTimeout(() => {
        setIsIdle(true)
      }, 4500)
    }

    resetIdle()
    window.addEventListener('pointermove', resetIdle, { passive: true })
    window.addEventListener('pointerdown', resetIdle, { passive: true })
    window.addEventListener('keydown', resetIdle, { passive: true })

    return () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
      }
      window.removeEventListener('pointermove', resetIdle)
      window.removeEventListener('pointerdown', resetIdle)
      window.removeEventListener('keydown', resetIdle)
    }
  }, [])

  if (theme !== 'cosmos') return null

  const handleToggleAutoDrift = () => {
    const next = !autoDrift
    setAutoDriftState(next)
    runtime.environment?.setAutoDrift(next)
  }

  const handleResetView = () => {
    runtime.environment?.resetView()
  }

  const handleExitSimulator = () => {
    setTheme('dusk')
  }

  return (
    <div
      className={`simulator-overlay ${isIdle && !settingsOpen ? 'simulator-overlay--idle' : ''}`}
      aria-label="6D Consciousness Simulator"
    >
      {/* Top minimal header */}
      <header className="simulator-header">
        <div className="simulator-header__brand">
          <span className="simulator-header__badge">6D EXPERIENCE</span>
          <h1 className="simulator-header__title">6D Consciousness Simulator</h1>
          <p className="simulator-header__subtitle">
            Explore evolving states of space, time and perception.
          </p>
        </div>

        <div className="simulator-header__actions">
          <ThemeMenu />
          <button
            type="button"
            className="simulator-btn simulator-btn--exit"
            onClick={handleExitSimulator}
            title="Exit simulator and return to Dusk"
            aria-label="Exit simulator"
          >
            <LogOut size={14} strokeWidth={1.5} aria-hidden="true" />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* Floating control dock */}
      <nav className="simulator-dock" aria-label="Simulator controls">
        {/* Play / Pause toggle */}
        <button
          type="button"
          className="simulator-dock__btn simulator-dock__btn--primary"
          onClick={() => void runtime.togglePlayback()}
          aria-label={isPlaying ? 'Pause atmosphere' : 'Resume atmosphere'}
          title={isPlaying ? 'Pause atmosphere' : 'Resume atmosphere'}
        >
          {isPlaying ? (
            <Pause size={16} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Play size={16} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>

        <div className="simulator-dock__divider" aria-hidden="true" />

        {/* Ambience mute toggle */}
        <button
          type="button"
          className={`simulator-dock__btn ${audio.ambientMuted ? 'is-muted' : ''}`}
          onClick={() => updateAudio({ ambientMuted: !audio.ambientMuted })}
          aria-label={audio.ambientMuted ? 'Unmute ambience' : 'Mute ambience'}
          title={audio.ambientMuted ? 'Unmute ambience' : 'Mute ambience'}
        >
          {audio.ambientMuted ? (
            <VolumeX size={15} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Volume2 size={15} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>

        {/* Ambience volume slider */}
        <div className="simulator-dock__volume" title="Ambience volume">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={audio.ambientMuted ? 0 : audio.ambientMaster}
            onChange={(e) =>
              updateAudio({
                ambientMaster: parseFloat(e.target.value),
                ambientMuted: false,
              })
            }
            aria-label="Ambience volume"
            className="simulator-slider"
          />
        </div>

        <div className="simulator-dock__divider" aria-hidden="true" />

        {/* Auto-drift toggle */}
        <button
          type="button"
          className={`simulator-dock__btn ${autoDrift ? 'is-active' : ''}`}
          onClick={handleToggleAutoDrift}
          aria-label={autoDrift ? 'Disable camera auto-drift' : 'Enable camera auto-drift'}
          title={autoDrift ? 'Camera auto-drift: ON' : 'Camera auto-drift: OFF'}
        >
          <Compass size={15} strokeWidth={1.5} aria-hidden="true" />
        </button>

        {/* Reset view */}
        <button
          type="button"
          className="simulator-dock__btn"
          onClick={handleResetView}
          aria-label="Reset viewing angle"
          title="Reset camera view"
        >
          <RotateCcw size={15} strokeWidth={1.5} aria-hidden="true" />
        </button>

        {/* Settings panel trigger */}
        <button
          type="button"
          className={`simulator-dock__btn ${settingsOpen ? 'is-active' : ''}`}
          onClick={() => setSettingsOpen((prev) => !prev)}
          aria-label="Simulator settings"
          title="Simulator settings"
        >
          <Sliders size={15} strokeWidth={1.5} aria-hidden="true" />
        </button>

        {/* Fullscreen */}
        <button
          type="button"
          className="simulator-dock__btn"
          onClick={() => void runtime.toggleFullscreen()}
          aria-label={runtime.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={runtime.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {runtime.isFullscreen ? (
            <Minimize2 size={15} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Maximize2 size={15} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
      </nav>

      {/* Minimal settings panel */}
      {settingsOpen ? (
        <aside className="simulator-settings-panel" aria-label="Simulator settings panel">
          <div className="simulator-settings-panel__header">
            <h3>Simulator Settings</h3>
            <button
              type="button"
              className="simulator-settings-panel__close"
              onClick={() => setSettingsOpen(false)}
              aria-label="Close settings"
            >
              &times;
            </button>
          </div>

          <div className="simulator-settings-panel__row">
            <span className="simulator-settings-panel__label">Camera auto-drift</span>
            <button
              type="button"
              className={`simulator-switch ${autoDrift ? 'is-checked' : ''}`}
              onClick={handleToggleAutoDrift}
              role="switch"
              aria-checked={autoDrift}
            >
              <span className="simulator-switch__knob" />
            </button>
          </div>

          <div className="simulator-settings-panel__row">
            <span className="simulator-settings-panel__label">Visual intensity</span>
            <div className="simulator-settings-panel__slider-group">
              <input
                type="range"
                min="0.4"
                max="1.6"
                step="0.05"
                value={visuals.intensity}
                onChange={(e) => updateVisuals({ intensity: parseFloat(e.target.value) })}
                className="simulator-slider"
                aria-label="Visual intensity"
              />
              <span className="simulator-settings-panel__val">
                {Math.round(visuals.intensity * 100)}%
              </span>
            </div>
          </div>

          <div className="simulator-settings-panel__row">
            <span className="simulator-settings-panel__label">Reduced motion</span>
            <button
              type="button"
              className={`simulator-switch ${visuals.reducedMotion ? 'is-checked' : ''}`}
              onClick={() => updateVisuals({ reducedMotion: !visuals.reducedMotion })}
              role="switch"
              aria-checked={visuals.reducedMotion}
            >
              <span className="simulator-switch__knob" />
            </button>
          </div>

          <div className="simulator-settings-panel__row">
            <span className="simulator-settings-panel__label">Reset orientation</span>
            <button
              type="button"
              className="simulator-btn simulator-btn--secondary"
              onClick={handleResetView}
            >
              <RotateCcw size={12} strokeWidth={1.5} aria-hidden="true" />
              <span>Center view</span>
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  )
}

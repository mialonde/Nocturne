import { useState } from 'react'
import { useNocturneRuntime } from '../../runtime/NocturneRuntime'
import { useNocturneStore } from '../../store/useNocturneStore'
import type { AmbienceSoundId, ExperienceMode, ThemeId } from '../../types'
import { PanelSection } from '../panels/PanelSection'
import { useFeatureCopy } from './copy'
import { useCaptureBusy } from './useCaptureBusy'

export const READY_EXPERIENCES: {
  id: 'rain' | 'focus' | 'breath' | 'space'; theme: ThemeId; minutes: number;
  mode: ExperienceMode; tracks: Partial<Record<AmbienceSoundId, number>>
}[] = [
  { id: 'rain', theme: 'abyss', minutes: 30, mode: 'ambient', tracks: { rain: 0.55, distant_thunder: 0.15 } },
  { id: 'focus', theme: 'ether', minutes: 20, mode: 'binaural', tracks: { brown_noise: 0.3 } },
  { id: 'breath', theme: 'dusk', minutes: 10, mode: 'breath', tracks: { ocean: 0.35 } },
  { id: 'space', theme: 'cosmos', minutes: 20, mode: 'ambient', tracks: { spatial_drone: 0.4, deep_resonance: 0.2 } },
]

export function ReadyExperiences() {
  const copy = useFeatureCopy()
  const runtime = useNocturneRuntime()
  const captureBusy = useCaptureBusy()
  const [starting, setStarting] = useState(false)
  const begin = async (experience: typeof READY_EXPERIENCES[number]) => {
    if (starting || captureBusy) return
    setStarting(true)
    try {
      runtime.stopSession()
      const state = useNocturneStore.getState()
      useNocturneStore.setState({
        theme: experience.theme, ambientProfile: experience.theme, mode: experience.mode,
        breathRunning: experience.mode === 'breath',
        breathPattern: { inhale: 4, hold: 0, exhale: 6, rest: 0 },
        ambienceTrackVolumes: { ...experience.tracks }, activeMixId: null,
        audio: { ...state.audio, ambientEnabled: true, ambientMuted: false,
          carrier: 200, beat: 10, binauralEnabled: experience.mode === 'binaural' },
      })
      runtime.environment?.resetBreathing()
      await runtime.beginExperience()
      if (useNocturneStore.getState().audioStatus === 'playing') {
        useNocturneStore.getState().setSleepTimer(experience.minutes)
      }
    } finally { setStarting(false) }
  }
  return (
    <PanelSection title={copy.experiences}>
      <p className="control-hint">{copy.experienceHint}</p>
      <div className="preset-row preset-row--wide">
        {READY_EXPERIENCES.map((item) => <button key={item.id} type="button" disabled={captureBusy || starting}
          onClick={() => void begin(item)}>{copy[item.id]}</button>)}
      </div>
      {captureBusy ? <p className="control-hint">{copy.busy}</p> : null}
    </PanelSection>
  )
}

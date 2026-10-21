import { Headphones } from 'lucide-react'
import { computeBinauralPair, formatHz } from '../config/audio'
import { useNocturneStore } from '../store/useNocturneStore'

export function FrequencyReadout() {
  const audio = useNocturneStore((state) => state.audio)
  const mode = useNocturneStore((state) => state.mode)
  if (!audio.binauralEnabled) return null
  const pair = computeBinauralPair(audio.carrier, audio.beat)
  return (
    <aside className="frequency-readout" aria-label="Binaural frequency readout">
      <div className="frequency-readout__head">
        <Headphones size={13} strokeWidth={1.4} aria-hidden="true" />
        <span>{mode === 'breath' ? 'Binaural / breath' : 'Binaural field'}</span>
      </div>
      <div className="frequency-readout__channels">
        <div>
          <span>L</span>
          <strong>{formatHz(pair.left, 2)}</strong>
        </div>
        <div>
          <span>R</span>
          <strong>{formatHz(pair.right, 2)}</strong>
        </div>
      </div>
      <div className="frequency-readout__beat">
        <span>Δ beat</span>
        <strong>{formatHz(pair.beat, 2)}</strong>
      </div>
    </aside>
  )
}

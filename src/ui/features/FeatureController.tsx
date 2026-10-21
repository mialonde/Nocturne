import { useEffect, useState } from 'react'
import { VoiceGuide } from '../../audio/VoiceGuide'
import { livingFactors } from '../../audio/livingSoundscape'
import { useNocturneRuntime } from '../../runtime/NocturneRuntime'
import { useNocturneStore } from '../../store/useNocturneStore'
import type { AmbienceSoundId } from '../../config/ambience'

export function FeatureController() {
  const { audio } = useNocturneRuntime()
  const features = useNocturneStore((state) => state.features)
  const playing = useNocturneStore((state) => state.audioStatus === 'playing')
  const master = useNocturneStore((state) => state.audio.masterVolume)
  const [guide] = useState(() => new VoiceGuide())
  useEffect(() => {
    const start = () => {
      if (playing && features.voiceEnabled) guide.start(features.voiceVolume * master, features.voiceEverySec)
      else guide.stop()
    }
    start()
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.addEventListener('voiceschanged', start)
    return () => {
      guide.stop()
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.removeEventListener('voiceschanged', start)
    }
  }, [guide, playing, features.voiceEnabled, features.voiceVolume, features.voiceEverySec, master])
  useEffect(() => {
    if (!features.livingEnabled || !playing) { audio.setLivingFactors({}); return }
    let event = 0
    const tick = () => {
      const ids = Object.keys(useNocturneStore.getState().ambienceTrackVolumes) as AmbienceSoundId[]
      audio.setLivingFactors(livingFactors(features.livingSeed, event++, features.livingVariation, ids),
        Math.min(8, features.livingEverySec * 0.4))
    }
    tick()
    const timer = window.setInterval(tick, features.livingEverySec * 1000)
    return () => { window.clearInterval(timer); audio.setLivingFactors({}) }
  }, [audio, playing, features.livingEnabled, features.livingSeed, features.livingVariation, features.livingEverySec])
  return null
}

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
  const [guide] = useState(() => new VoiceGuide(audio))
  useEffect(() => {
    if (features.voiceEnabled) {
      guide.configure(features.voiceProfile, () => {
        const state = useNocturneStore.getState()
        state.updateFeatures({ voiceEnabled: false })
        state.showToast(state.language === 'tr'
          ? 'Bu rehberin ses kaydı henüz eklenmedi veya okunamadı.'
          : 'This guidance recording is missing or could not be read.', 'warning')
      })
    } else {
      guide.stop()
    }
    return () => guide.stop()
  }, [guide, features.voiceEnabled, features.voiceProfile])
  useEffect(() => {
    guide.setVolume(features.voiceVolume)
  }, [guide, features.voiceVolume])
  useEffect(() => {
    if (!features.voiceEnabled || !playing) {
      guide.pause()
      return
    }
    guide.resume()
  }, [guide, playing, features.voiceEnabled, features.voiceProfile])
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

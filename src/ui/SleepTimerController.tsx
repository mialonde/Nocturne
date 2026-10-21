import { useEffect } from 'react'
import { useNocturneRuntime } from '../runtime/NocturneRuntime'
import { useNocturneStore } from '../store/useNocturneStore'
import { translate } from '../language'
import { startSleepTimer } from '../session/sleepTimer'

export function SleepTimerController() {
  const { audio, recording, audioExporter, stopAll } = useNocturneRuntime()
  const endsAt = useNocturneStore((state) => state.sleepTimer.endsAt)

  useEffect(() => {
    if (!endsAt) return
    return startSleepTimer(endsAt, {
      scheduleFade: (seconds) => audio.scheduleSleepFade(seconds),
      resetFade: () => audio.resetSleepFade(0.4),
      onTick: (remainingMs) => useNocturneStore.getState().updateSleepTimer({ remainingMs }),
      onExpire: () => {
        const phase = recording.getSnapshot().phase
        if (phase === 'recording' || phase === 'paused' || phase === 'preparing') recording.stop()
        void audioExporter.stop()
        // stopAll restores the sleep fade after the transport has faded out.
        stopAll()
        const state = useNocturneStore.getState()
        state.showToast(translate(state.language, 'sleep.endedToast'), 'quiet')
      },
    })
  }, [endsAt, audio, recording, audioExporter, stopAll])

  return null
}

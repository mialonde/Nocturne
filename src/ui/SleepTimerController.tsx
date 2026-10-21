import { useEffect, useRef } from 'react'
import { useNocturneRuntime } from '../runtime/NocturneRuntime'
import { useNocturneStore } from '../store/useNocturneStore'
import { translate } from '../language'

const FADE_SECONDS = 60

/**
 * Owns the timer lifecycle outside the visible interface. The timer keeps
 * counting down when the UI is hidden, and the fade is scheduled on the shared
 * audio output rather than by rewriting the user's saved master volume.
 */
export function SleepTimerController() {
  const runtime = useNocturneRuntime()
  const endsAt = useNocturneStore((state) => state.sleepTimer.endsAt)
  const fadeStarted = useRef(false)
  const expired = useRef(false)

  useEffect(() => {
    if (!endsAt) return
    fadeStarted.current = false
    expired.current = false

    const tick = () => {
      const remaining = Math.max(0, endsAt - Date.now())
      const state = useNocturneStore.getState()
      state.updateSleepTimer({ remainingMs: remaining })

      if (remaining <= FADE_SECONDS * 1000 && !fadeStarted.current) {
        fadeStarted.current = true
        runtime.audio.scheduleSleepFade(Math.max(0.2, remaining / 1000))
      }

      if (remaining <= 0 && !expired.current) {
        expired.current = true
        const phase = runtime.recording.getSnapshot().phase
        if (phase === 'recording' || phase === 'paused' || phase === 'preparing') {
          runtime.recording.stop()
        }
        runtime.stopAll()
        useNocturneStore.getState().clearSleepTimer()
        const { language } = useNocturneStore.getState()
        useNocturneStore.getState().showToast(translate(language, 'sleep.endedToast'), 'quiet')
        // Let the short transport fade finish before restoring the shared fade
        // stage for the next listening session.
        window.setTimeout(() => runtime.audio.resetSleepFade(0.6), 1200)
      }
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [endsAt, runtime])

  return null
}

interface SleepTimerCallbacks {
  scheduleFade: (seconds: number) => void
  resetFade: () => void
  onTick: (remainingMs: number) => void
  onExpire: () => void
}

/** Cancelling or replacing a deadline also cancels its scheduled audio fade. */
export function startSleepTimer(endsAt: number, callbacks: SleepTimerCallbacks): () => void {
  let fadeStarted = false
  let expired = false
  let cancelled = false
  const tick = () => {
    if (expired || cancelled) return
    const remaining = Math.max(0, endsAt - Date.now())
    callbacks.onTick(remaining)
    if (remaining === 0) {
      expired = true
      callbacks.onExpire()
    } else if (remaining <= 60_000 && !fadeStarted) {
      fadeStarted = true
      callbacks.scheduleFade(remaining / 1000)
    }
  }
  tick()
  const interval = window.setInterval(tick, 1000)
  return () => {
    cancelled = true
    window.clearInterval(interval)
    if (fadeStarted && !expired) callbacks.resetFade()
  }
}

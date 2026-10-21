/**
 * Keeps the display awake while a session or a long playback is running.
 *
 * The Screen Wake Lock API is used when the browser supports it. The lock is
 * released by the browser when the tab is hidden, so it has to be requested
 * again when the tab becomes visible.
 */
export class ScreenAwake {
  private sentinel: WakeLockSentinel | null = null
  private wanted = false

  get supported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator
  }

  get active(): boolean {
    return this.sentinel !== null && !this.sentinel.released
  }

  /** Requests the lock when it is wanted, releases it otherwise. */
  async setEnabled(enabled: boolean): Promise<void> {
    this.wanted = enabled
    if (!enabled) {
      await this.release()
      return
    }
    await this.acquire()
  }

  /** Re-requests the lock after the tab became visible again. */
  async refresh(): Promise<void> {
    if (this.wanted) await this.acquire()
  }

  async release(): Promise<void> {
    const sentinel = this.sentinel
    this.sentinel = null
    if (!sentinel) return
    try {
      await sentinel.release()
    } catch {
      // The lock may already have been released by the platform.
    }
  }

  private async acquire(): Promise<void> {
    if (!this.supported || this.active || !this.wanted) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    try {
      const sentinel = await navigator.wakeLock.request('screen')
      this.sentinel = sentinel
      sentinel.addEventListener('release', () => {
        if (this.sentinel === sentinel) this.sentinel = null
      })
    } catch {
      // Denied or unavailable. The session keeps running without it.
      this.sentinel = null
    }
  }
}

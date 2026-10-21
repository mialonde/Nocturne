/**
 * Registers the offline worker and keeps the install prompt available.
 *
 * The worker is only registered in a production build. In development it
 * would cache the module graph and hide recent changes.
 */

let installEvent: InstallPromptEvent | null = null
let installListener: (() => void) | null = null

/**
 * The install prompt is not part of the standard DOM library yet.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function canInstall(): boolean {
  return installEvent !== null
}

/** Subscribes to install availability changes. Returns an unsubscribe function. */
export function onInstallAvailable(listener: () => void): () => void {
  installListener = listener
  return () => {
    if (installListener === listener) installListener = null
  }
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!installEvent) return 'unavailable'
  const event = installEvent
  installEvent = null
  installListener?.()
  await event.prompt()
  const choice = await event.userChoice
  return choice.outcome === 'accepted' ? 'accepted' : 'dismissed'
}

export function registerOfflineWorker(): void {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) return

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installEvent = event as InstallPromptEvent
    installListener?.()
  })

  window.addEventListener('appinstalled', () => {
    installEvent = null
    installListener?.()
  })

  const register = () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Offline support is optional; the app works without it.
    })
  }

  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

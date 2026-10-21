/**
 * Publishes the room to the operating system media session.
 *
 * This gives the lock screen a title, artwork and transport controls.
 * Background playback still depends on the browser and operating system.
 */

export interface MediaSessionTransport {
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSeek?: (positionMs: number) => void
}

/** Serialize hardware commands so repeated play/pause events cannot toggle playback. */
export function createMediaTransport(
  getPlaying: () => boolean,
  toggle: () => Promise<void>,
  stop: () => void,
  onError: (error: unknown) => void,
): MediaSessionTransport {
  let pending = Promise.resolve()
  const request = (playing: boolean | null) => {
    pending = pending.then(async () => {
      if (playing === null) stop()
      else if (getPlaying() !== playing) await toggle()
    }).catch(onError)
  }
  return {
    onPlay: () => request(true),
    onPause: () => request(false),
    onStop: () => request(null),
  }
}

function setHandler(session: MediaSession, action: MediaSessionAction, handler: MediaSessionActionHandler | null): void {
  try { session.setActionHandler(action, handler) } catch {
    // A browser can expose mediaSession without supporting every action.
  }
}

export interface MediaSessionView {
  title: string
  artist: string
  album: string
  playing: boolean
  positionMs: number
  durationMs: number
  seekable: boolean
}

const ARTWORK = [
  { src: '/og-cover.jpg', sizes: '1200x630', type: 'image/jpeg' },
  { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
]

export function isMediaSessionSupported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator
}

/**
 * Writes the current state into the media session and installs the transport
 * handlers. Unsupported actions are ignored independently.
 */
export function updateMediaSession(
  view: MediaSessionView,
  transport: MediaSessionTransport,
): void {
  if (!isMediaSessionSupported()) return
  const session = navigator.mediaSession

  try {
    session.metadata = new MediaMetadata({
      title: view.title,
      artist: view.artist,
      album: view.album,
      artwork: ARTWORK,
    })
  } catch {
    // MediaMetadata is not available everywhere. The rest still works.
  }

  if (view.seekable && view.durationMs > 0) {
    try {
      session.setPositionState({
        duration: view.durationMs / 1000,
        playbackRate: 1,
        position: Math.max(0, Math.min(view.positionMs / 1000, view.durationMs / 1000)),
      })
    } catch {
      // Some browsers reject a position state that is ahead of the duration.
    }
  } else {
    try { session.setPositionState() } catch { /* Optional API. */ }
  }

  session.playbackState = view.playing ? 'playing' : 'paused'

  setHandler(session, 'play', () => transport.onPlay())
  setHandler(session, 'pause', () => transport.onPause())
  setHandler(session, 'stop', () => transport.onStop())
  if (view.seekable && transport.onSeek) {
    setHandler(session, 'seekto', (details) => {
      transport.onSeek?.((details.seekTime ?? 0) * 1000)
    })
  } else {
    setHandler(session, 'seekto', null)
  }
}

/** Clears the media session, for example when the room is stopped. */
export function clearMediaSession(): void {
  if (!isMediaSessionSupported()) return
  for (const action of ['play', 'pause', 'stop', 'seekto'] as const) {
    setHandler(navigator.mediaSession, action, null)
  }
  try { navigator.mediaSession.setPositionState() } catch { /* Optional API. */ }
  try {
    navigator.mediaSession.metadata = null
    navigator.mediaSession.playbackState = 'none'
  } catch {
    // Nothing to clear.
  }
}

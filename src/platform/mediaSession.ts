/**
 * Publishes the room to the operating system media session.
 *
 * This gives the lock screen a title, artwork and transport controls, and it
 * is what keeps the audio session alive on mobile once the screen is locked.
 */

export interface MediaSessionTransport {
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSeek?: (positionMs: number) => void
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
 * handlers. The handlers are only attached once; later calls only refresh the
 * state.
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
        position: Math.min(view.positionMs / 1000, view.durationMs / 1000),
      })
    } catch {
      // Some browsers reject a position state that is ahead of the duration.
    }
  }

  session.playbackState = view.playing ? 'playing' : 'paused'

  session.setActionHandler('play', () => transport.onPlay())
  session.setActionHandler('pause', () => transport.onPause())
  session.setActionHandler('stop', () => transport.onStop())
  if (view.seekable && transport.onSeek) {
    session.setActionHandler('seekto', (details) => {
      transport.onSeek?.((details.seekTime ?? 0) * 1000)
    })
  } else {
    try {
      session.setActionHandler('seekto', null)
    } catch {
      // Not every browser knows this action.
    }
  }
}

/** Clears the media session, for example when the room is stopped. */
export function clearMediaSession(): void {
  if (!isMediaSessionSupported()) return
  try {
    navigator.mediaSession.metadata = null
    navigator.mediaSession.playbackState = 'none'
  } catch {
    // Nothing to clear.
  }
}

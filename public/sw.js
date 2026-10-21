/* eslint-env serviceworker */
/**
 * NOCTURNE offline worker.
 *
 * The build output has hashed file names, so the worker caches what it sees
 * at runtime instead of a precache list:
 *
 *   - the ambience recordings are cached first, they are the largest and the
 *     most useful offline,
 *   - the app shell and the hashed assets use a stale-while-revalidate
 *     strategy, so a new build is picked up on the next visit,
 *   - navigations fall back to the cached shell when the network is gone.
 */
const VERSION = 'nocturne-v1'
const SHELL_CACHE = `${VERSION}-shell`
const AUDIO_CACHE = `${VERSION}-audio`

const AUDIO_PATTERN = /\/audio\/ambient\/.+\.(ogg|mp3)$/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(['/', '/index.html', '/favicon.svg', '/manifest.webmanifest']))
      .catch(() => undefined),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

async function cacheFirstAudio(request) {
  const cache = await caches.open(AUDIO_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    void cache.put(request, response.clone())
  }
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone())
      return response
    })
    .catch(() => undefined)
  if (cached) {
    void network
    return cached
  }
  const response = await network
  if (response) return response
  return new Response('', { status: 504, statusText: 'Offline' })
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request)
    const cache = await caches.open(SHELL_CACHE)
    if (response.ok) void cache.put('/index.html', response.clone())
    return response
  } catch {
    const cached = await caches.match('/index.html')
    return cached ?? new Response('', { status: 504, statusText: 'Offline' })
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (AUDIO_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirstAudio(request))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  event.respondWith(staleWhileRevalidate(request))
})

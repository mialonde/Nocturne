/* eslint-env serviceworker */
// The production build replaces both values with a content version and full asset list.
const VERSION = 'nocturne-dev'
const PRECACHE_ASSETS = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest']
const SHELL_CACHE = `${VERSION}-shell`
const AUDIO_CACHE = `${VERSION}-audio`
const AUDIO_PATTERN = /^\/audio\/ambient\/.+\.(ogg|mp3)$/

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS)))
  // Wait for existing tabs to close before changing builds underneath them.
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('nocturne-') && key !== SHELL_CACHE && key !== AUDIO_CACHE)
      .map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()))
})

async function remember(cache, request, response) {
  if (!response.ok || response.status === 206) return
  try { await cache.put(request, response.clone()) } catch {
    // Quota or storage failures must not interrupt an otherwise usable response.
  }
}

async function audioResponse(request, event) {
  const cache = await caches.open(AUDIO_CACHE)
  try {
    // Refresh unchanged URLs too: a new recording must not stay stale forever.
    const response = await fetch(request)
    if (response.ok) {
      event.waitUntil(remember(cache, request, response))
      return response
    }
    return (await cache.match(request)) ?? response
  } catch {
    return (await cache.match(request)) ?? new Response('', { status: 504, statusText: 'Offline' })
  }
}

async function shellResponse(request, event) {
  const cache = await caches.open(SHELL_CACHE)
  if (request.mode === 'navigate') {
    // Use the shell belonging to this worker, including while a newer worker waits.
    const shell = await cache.match('/index.html')
    if (shell) return shell
  }
  const cached = await cache.match(request)
  if (cached) return cached // Production assets have content-hashed names.
  try {
    const response = await fetch(request)
    if (new URL(request.url).pathname.startsWith('/assets/')) {
      event.waitUntil(remember(cache, request, response))
    }
    return response
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' })
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || request.headers.has('range')) return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (AUDIO_PATTERN.test(url.pathname)) {
    event.respondWith(audioResponse(request, event))
  } else if (request.mode === 'navigate' || url.pathname.startsWith('/assets/') ||
    PRECACHE_ASSETS.includes(url.pathname)) {
    event.respondWith(shellResponse(request, event))
  }
})

import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import source from '../../public/sw.js?raw'

function worker() {
  const listeners = {}
  const stores = new Map()
  const caches = {
    keys: async () => [...stores.keys()],
    delete: vi.fn(async (key) => stores.delete(key)),
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map())
      const entries = stores.get(name)
      const key = (request) => typeof request === 'string' ? request : request.url
      return {
        addAll: async () => {},
        match: async (request) => entries.get(key(request))?.clone(),
        put: async (request, response) => { entries.set(key(request), response.clone()) },
      }
    },
  }
  const fetch = vi.fn()
  const self = {
    location: { origin: 'https://nocturne.test' },
    clients: { claim: vi.fn() },
    addEventListener: (name, listener) => { listeners[name] = listener },
  }
  runInNewContext(source, { self, caches, fetch, URL, Response })
  const request = async (pathname, options = {}) => {
    const work = []
    let response
    listeners.fetch({
      request: { url: self.location.origin + pathname, method: 'GET', mode: 'cors', headers: new Headers(), ...options },
      waitUntil: (promise) => work.push(promise),
      respondWith: (promise) => { response = promise },
    })
    const result = await response
    await Promise.all(work)
    return result
  }
  return { listeners, caches, fetch, stores, request }
}

describe('offline worker', () => {
  it('removes only obsolete Nocturne caches', async () => {
    const w = worker()
    for (const key of ['other-app-v1', 'nocturne-v1-shell', 'nocturne-dev-shell', 'nocturne-dev-audio']) {
      await w.caches.open(key)
    }
    let work
    w.listeners.activate({ waitUntil: (promise) => { work = promise } })
    await work
    expect(w.caches.delete.mock.calls).toEqual([['nocturne-v1-shell']])
    expect(w.stores.has('other-app-v1')).toBe(true)
  })

  it('refreshes recordings at unchanged URLs and retains offline playback', async () => {
    const w = worker()
    const cache = await w.caches.open('nocturne-dev-audio')
    await cache.put('https://nocturne.test/audio/ambient/rain.ogg', new Response('old'))
    w.fetch.mockResolvedValueOnce(new Response('new'))
    expect(await (await w.request('/audio/ambient/rain.ogg')).text()).toBe('new')
    w.fetch.mockRejectedValueOnce(new Error('offline'))
    expect(await (await w.request('/audio/ambient/rain.ogg')).text()).toBe('new')
  })

  it('uses its own app shell while a newer release waits', async () => {
    const w = worker()
    const cache = await w.caches.open('nocturne-dev-shell')
    await cache.put('/index.html', new Response('current shell'))
    expect(await (await w.request('/', { mode: 'navigate' })).text()).toBe('current shell')
    expect(w.fetch).not.toHaveBeenCalled()
  })

  it('does not cache range requests or unrelated endpoints', async () => {
    const w = worker()
    expect(await w.request('/audio/ambient/rain.ogg', { headers: new Headers({ range: 'bytes=0-100' }) })).toBeUndefined()
    expect(await w.request('/api/account')).toBeUndefined()
    expect(w.fetch).not.toHaveBeenCalled()
  })

  it('can play cached audio when the server returns an error', async () => {
    const w = worker()
    const cache = await w.caches.open('nocturne-dev-audio')
    await cache.put('https://nocturne.test/audio/ambient/rain.ogg', new Response('cached'))
    w.fetch.mockResolvedValueOnce(new Response('', { status: 503 }))
    expect(await (await w.request('/audio/ambient/rain.ogg')).text()).toBe('cached')
  })
})

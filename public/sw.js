/* eslint-disable no-restricted-globals */
/**
 * Issue #220: Nashrino service worker.
 *
 * Caching strategy:
 *   - NetworkFirst  for /api/  (inbox, notifications) — always try the network
 *     first so the user sees fresh data when online; fall back to a stale
 *     cache only when offline.
 *   - StaleWhileRevalidate for /_next/static/ and images — serve from cache
 *     instantly, refresh in the background.
 *   - Compose drafts are cached locally via the existing ContentDraft API
 *     (server-side persistence) — the SW just makes the /api/compose-draft
 *     endpoint available offline by queuing failed writes in a separate
 *     "compose-outbox" cache and replaying them when connectivity returns.
 *
 * The SW intentionally does NOT cache /api/auth/ (auth flows must always hit
 * the network) or /api/reports/export (large file downloads).
 */

const CACHE_VERSION = 'nashrino-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const API_CACHE = `${CACHE_VERSION}-api`
const COMPOSE_OUTBOX = `${CACHE_VERSION}-compose-outbox`

const PRECACHE_URLS = ['/', '/logo.svg', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(CACHE_VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') {
    // For non-GET requests (e.g. POST /api/compose-draft), try the network;
    // if it fails AND the URL is a compose-draft write, queue it for replay.
    if (req.method === 'POST' && new URL(req.url).pathname === '/api/compose-draft') {
      event.respondWith(queueComposeWrite(req))
    }
    return
  }

  const url = new URL(req.url)
  // Never cache auth or large downloads.
  if (url.pathname.startsWith('/api/auth/') || url.pathname === '/api/reports/export') {
    return
  }

  // NetworkFirst for /api/.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(req, API_CACHE))
    return
  }

  // StaleWhileRevalidate for static assets + images.
  if (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(req, STATIC_CACHE))
    return
  }

  // Default: try network, fall back to cache (for navigations).
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
  )
})

async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req)
    const copy = res.clone()
    const cache = await caches.open(cacheName)
    cache.put(req, copy).catch(() => {})
    return res
  } catch (err) {
    const cached = await caches.match(req)
    if (cached) return cached
    throw err
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(req)
  const network = fetch(req)
    .then((res) => {
      const copy = res.clone()
      cache.put(req, copy).catch(() => {})
      return res
    })
    .catch(() => cached)
  return cached || network
}

async function queueComposeWrite(req) {
  try {
    return await fetch(req)
  } catch (err) {
    // Network failed — stash the request body for replay.
    const body = await req.clone().text()
    const cache = await caches.open(COMPOSE_OUTBOX)
    const id = `compose-${Date.now()}`
    // We can't put a POST Request in the Cache API directly (it only caches
    // GET), so stash a synthetic Response carrying the body + headers.
    const synthetic = new Response(
      JSON.stringify({ url: req.url, method: req.method, body, headers: Object.fromEntries(req.headers.entries()) }),
      { headers: { 'Content-Type': 'application/json' } }
    )
    await cache.put(id, synthetic)
    // Best-effort: replay the queue on next online event.
    self.registration.sync?.register('nashrino-compose-replay').catch(() => {})
    // Surface a 200 with an offline marker so the client code can show a
    // "queued offline" toast instead of an error.
    return new Response(JSON.stringify({ ok: true, queued: true, offline: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Replay queued compose writes when connectivity returns.
self.addEventListener('sync', (event) => {
  if (event.tag === 'nashrino-compose-replay') {
    event.waitUntil(replayComposeQueue())
  }
})

async function replayComposeQueue() {
  const cache = await caches.open(COMPOSE_OUTBOX)
  const requests = await cache.keys()
  for (const req of requests) {
    const res = await cache.match(req)
    if (!res) continue
    const payload = await res.json()
    try {
      await fetch(payload.url, {
        method: payload.method,
        headers: payload.headers,
        body: payload.body,
      })
      await cache.delete(req)
    } catch {
      // Still offline — leave it queued.
    }
  }
}

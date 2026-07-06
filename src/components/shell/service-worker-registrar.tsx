'use client'

/**
 * Issue #220: Service worker registration.
 *
 * Registered on first client mount (after `load`) so it never blocks the
 * initial paint. On update, the new SW takes over on the next navigation
 * (skipWaiting in the SW + clients.claim). Skipped entirely when:
 *   - the protocol is not http/https (e.g. file://),
 *   - the host is localhost AND the NODE_ENV is production (avoid caching
 *     during local dev unless explicitly opted-in via ?sw=1).
 */

import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (!window.isSecureContext) return

    const url = new URL(window.location.href)
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    const forceSw = url.searchParams.get('sw') === '1'
    if (isLocalhost && process.env.NODE_ENV === 'production' && !forceSw) return

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('[sw] registration failed:', err)
        })
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })

    return () => window.removeEventListener('load', register)
  }, [])

  return null
}

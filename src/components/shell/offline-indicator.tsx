'use client'

/**
 * Issue #220: Offline indicator badge.
 *
 * Shows a "آفلاین" badge in the app shell when `navigator.onLine` is false.
 * Listens to `online` / `offline` events so the badge appears / disappears
 * in real time as connectivity changes. Uses `useSyncExternalStore` so it
 * works correctly with React 18 concurrent rendering (no tearing).
 */

import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getSnapshot(): boolean {
  return typeof navigator !== 'undefined' ? !navigator.onLine : false
}

function getServerSnapshot(): boolean {
  return false
}

export function OfflineIndicator() {
  const isOffline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (!isOffline) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-warning-tint text-warning text-2xs font-bold"
    >
      <WifiOff className="size-3" />
      آفلاین
    </div>
  )
}

'use client'

import { useEffect, useRef, useCallback } from 'react'

/* ============================================================================
   ARIA LIVE REGION SYSTEM
   For announcing dynamic changes to screen readers:
   - Notification count changes
   - KPI updates
   - Optimistic mutation confirmations
   - Toast equivalents for non-visual users

   Two politeness levels:
   - polite: announces when SR is idle (default — for counts, status)
   - assertive: announces immediately (for errors, critical updates)
   ============================================================================ */

let liveRegionRef: HTMLDivElement | null = null
let assertiveRegionRef: HTMLDivElement | null = null

/** Register the live region elements (called once by LiveRegionProvider) */
export function registerLiveRegion(polite: HTMLDivElement, assertive: HTMLDivElement) {
  liveRegionRef = polite
  assertiveRegionRef = assertive
}

/** Announce a message to screen readers.
 *  @param message - Persian text to announce
 *  @param politeness - "polite" (default) or "assertive"
 *  @param clearAfter - ms to wait before clearing (default 1500). Clearing prevents
 *                      re-announcement of the same message if it's set again. */
export function announce(
  message: string,
  politeness: 'polite' | 'assertive' = 'polite',
  clearAfter = 1500
) {
  const ref = politeness === 'assertive' ? assertiveRegionRef : liveRegionRef
  if (!ref) return

  // Force re-announcement even if the message is the same:
  // clear first, then set on next tick
  ref.textContent = ''
  window.setTimeout(() => {
    ref.textContent = message
    if (clearAfter > 0) {
      window.setTimeout(() => {
        ref.textContent = ''
      }, clearAfter)
    }
  }, 50)
}

/** LiveRegionProvider — mount ONCE at the app root.
 *  Renders two visually-hidden divs for polite + assertive announcements. */
export function LiveRegionProvider() {
  const politeRef = useRef<HTMLDivElement>(null)
  const assertiveRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (politeRef.current && assertiveRef.current) {
      registerLiveRegion(politeRef.current, assertiveRef.current)
    }
    return () => {
      liveRegionRef = null
      assertiveRegionRef = null
    }
  }, [])

  return (
    <>
      <div ref={politeRef} aria-live="polite" aria-atomic="true" className="sr-only" />
      <div ref={assertiveRef} aria-live="assertive" aria-atomic="true" className="sr-only" />
    </>
  )
}

/** useAriaLive — hook for announcing count changes.
 *  Automatically announces when the value changes by a meaningful amount.
 *  @example
 *  const { announceChange } = useAriaLive();
 *  announceChange(unreadCount, "پیام خوانده‌نشده"); // → "۵ پیام خوانده‌نشده" */
export function useAriaLive() {
  const announceChange = useCallback(
    (count: number, label: string, politeness: 'polite' | 'assertive' = 'polite') => {
      if (count === 0) {
        announce(`هیچ ${label} وجود ندارد`, politeness)
      } else {
        announce(`${count.toLocaleString('fa-IR')} ${label}`, politeness)
      }
    },
    []
  )

  return { announceChange, announce }
}

/** useAnnounceValue — announces when a value changes.
 *  Useful for KPI cards, notification badges, etc.
 *  Uses a ref to track previous value (no setState-in-effect). */
export function useAnnounceValue(
  value: number,
  label: string,
  politeness: 'polite' | 'assertive' = 'polite'
) {
  const prevRef = useRef(value)
  useEffect(() => {
    if (prevRef.current !== value) {
      const diff = value - prevRef.current
      const direction = diff > 0 ? 'افزایش' : 'کاهش'
      const absDiff = Math.abs(diff)
      announce(
        `${direction} ${absDiff.toLocaleString('fa-IR')} ${label}، مجموع ${value.toLocaleString('fa-IR')}`,
        politeness
      )
      prevRef.current = value
    }
  }, [value, label, politeness])
}

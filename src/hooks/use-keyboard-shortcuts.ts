'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'

/**
 * useKeyboardShortcuts — global keyboard navigation.
 *
 * Wires the shortcuts advertised in the ShortcutsModal:
 *   G then D  → Dashboard (/)
 *   G then C  → Calendar (/calendar)
 *   G then I  → Inbox (/inbox)
 *   G then A  → Analytics (/analytics)
 *   G then S  → Settings (/settings)
 *   C         → Compose (/compose)
 *   N         → New Campaign (/campaigns)
 *   ⌘K / Ctrl+K → Command palette
 *   ?          → Shortcuts modal
 *   Esc        → Close any open modal
 *
 * Two-step "G then X" sequences use a 600ms timeout window (Linear/Raycast style).
 * All shortcuts are ignored when typing in inputs/textareas/contentEditable.
 */

// Maps keyboard keys to URL paths for G-prefix shortcuts
const G_PREFIX_MAP: Record<string, string> = {
  d: '/',
  c: '/calendar',
  i: '/inbox',
  a: '/analytics',
  s: '/settings',
}

// Maps single-key shortcuts to URL paths (no prefix)
const VIEW_DIRECT_MAP: Record<string, string> = {
  c: '/compose',
  n: '/campaigns',
}

export function useKeyboardShortcuts() {
  const router = useRouter()
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen)
  const setMobileMenuOpen = useAppStore((s) => s.setMobileMenuOpen)
  const isCommandPaletteOpen = useAppStore((s) => s.isCommandPaletteOpen)
  const isShortcutsOpen = useAppStore((s) => s.isShortcutsOpen)

  useEffect(() => {
    let gPressed = false
    let gTimer: ReturnType<typeof setTimeout> | null = null

    const isTyping = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
    }

    const clearG = () => {
      gPressed = false
      if (gTimer) {
        clearTimeout(gTimer)
        gTimer = null
      }
    }

    const handler = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K — always works (even in some inputs, but not in contentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!isCommandPaletteOpen)
        return
      }

      // Escape — close any open modal
      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) setCommandPaletteOpen(false)
        else if (isShortcutsOpen) setShortcutsOpen(false)
        else if (typeof document !== 'undefined') {
          const open = document.querySelector("[data-state='open']")
          if (open) (open as HTMLElement).click()
        }
        return
      }

      // ? — show shortcuts modal (shift+/ = ?)
      if (e.key === '?' && !isTyping(e.target)) {
        e.preventDefault()
        setShortcutsOpen(!isShortcutsOpen)
        return
      }

      // Don't process shortcuts while typing
      if (isTyping(e.target)) return

      const key = e.key.toLowerCase()

      // G-prefix sequences (G then D/C/I/A/S)
      if (key === 'g') {
        if (!gPressed) {
          gPressed = true
          gTimer = setTimeout(clearG, 600)
        }
        return
      }

      if (gPressed) {
        const target = G_PREFIX_MAP[key]
        if (target) {
          e.preventDefault()
          router.push(target)
          setMobileMenuOpen(false)
        }
        clearG()
        return
      }

      // Direct shortcuts (single key)
      const directTarget = VIEW_DIRECT_MAP[key]
      if (directTarget) {
        e.preventDefault()
        router.push(directTarget)
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    router,
    setCommandPaletteOpen,
    setShortcutsOpen,
    setMobileMenuOpen,
    isCommandPaletteOpen,
    isShortcutsOpen,
  ])
}

'use client'

/**
 * Issue #220: PWA install prompt banner.
 *
 * Listens for the browser's `beforeinstallprompt` event (Chrome/Edge/Brave).
 * When fired, stashes the event and shows a dismissible banner offering to
 * install Nashrino as a standalone app. On iOS Safari (no
 * `beforeinstallprompt`), the banner is not shown — iOS install is a manual
 * Share → Add to Home Screen action that we can't trigger programmatically.
 */

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'nashrino-install-dismissed-at'
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      // Respect a recent dismissal.
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
      if (Date.now() - dismissedAt < DISMISS_TTL_MS) return
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const onInstall = async () => {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'accepted') {
      setVisible(false)
    }
    setDeferred(null)
  }

  const onDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="نصب اپلیکیشن نشرینو"
      className="fixed inset-x-0 bottom-4 z-50 mx-auto max-w-md px-4"
    >
      <div className="n-card n-gradient-border p-4 flex items-center gap-3 shadow-lg">
        <div className="size-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
          <Download className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-ink-primary">نصب نشرینو</p>
          <p className="text-2xs text-ink-tertiary mt-0.5">
            اپلیکیشن نشرینو را روی دستگاه خود نصب کنید تا دسترسی سریع‌تر داشته باشید.
          </p>
        </div>
        <Button size="sm" className="n-focus-ring shrink-0" onClick={onInstall}>
          نصب
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 n-focus-ring"
          onClick={onDismiss}
          aria-label="بستن"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { ease } from '@/lib/motion'

/**
 * error.tsx — App Router error boundary.
 * Catches runtime errors in any route segment and renders a
 * recoverable error state with a retry CTA.
 *
 * Per AUDIT-1B recommendation: the app had ZERO error-state patterns.
 * This is the top-level boundary; nested boundaries can be added per-view.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to console (replace with Sentry/PostHog in production)
    // eslint-disable-next-line no-console
    console.error('[نشرینو] Route error boundary:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: ease.emphasized }}
        className="n-card max-w-md w-full p-8 text-center"
      >
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-danger-soft">
          <AlertTriangle className="size-7 text-danger" strokeWidth={2} />
        </div>
        <h2 className="text-lg font-bold text-ink-primary mb-2 tracking-tight">
          خطایی رخ داد
        </h2>
        <p className="text-sm text-ink-secondary leading-relaxed mb-1">
          متأسفانه در بارگذاری این بخش مشکلی پیش آمد.
        </p>
        <p className="text-xs text-ink-tertiary mb-6 num-tabular" dir="ltr">
          {error.digest && `شناسه خطا: ${error.digest}`}
        </p>
        <button
          onClick={reset}
          className="n-focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          <RefreshCw className="size-4" strokeWidth={2.5} />
          تلاش مجدد
        </button>
      </motion.div>
    </div>
  )
}

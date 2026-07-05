'use client'

/**
 * Issue #250: Smart Page link/social block click tracker.
 *
 * Wraps a link/social block anchor and fires a fire-and-forget POST to
 * /api/smart-pages/track whenever the visitor clicks it. The POST never
 * blocks navigation — we use `keepalive: true` so the beacon survives the
 * page unload when the link opens in the same tab, and we never surface
 * errors to the visitor (analytics failures must be silent).
 *
 * The wrapper renders a single <a> tag and forwards all standard anchor
 * props, so it can be styled by the parent Server Component exactly like
 * a plain anchor.
 */

import { type MouseEvent, type ReactNode, useCallback } from 'react'
import { type SmartPageBlock } from '@/modules/smart-pages'

interface SmartPageClickTrackerProps {
  slug: string
  block: Extract<SmartPageBlock, { type: 'link' | 'social' }>
  href: string
  children: ReactNode
  className?: string
  /** When true (default), opens the link in a new tab. */
  external?: boolean
}

export function SmartPageClickTracker({
  slug,
  block,
  href,
  children,
  className,
  external = true,
}: SmartPageClickTrackerProps) {
  const handleClick = useCallback(
    (_e: MouseEvent<HTMLAnchorElement>) => {
      // Fire-and-forget analytics beacon. keepalive lets the request outlive
      // the current document if the link navigates the top frame.
      const payload = {
        slug,
        blockId: block.id,
        blockType: block.type,
        label: block.type === 'link' ? block.label : block.label ?? block.platform,
        url: href,
        referrer: typeof document !== 'undefined' ? document.referrer || null : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }

      try {
        void fetch('/api/smart-pages/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
          // Bypass the React Query cache + don't wait for response.
        }).catch(() => {
          /* analytics failure is non-fatal */
        })
      } catch {
        /* ignore */
      }
    },
    [slug, block, href]
  )

  return (
    <a
      href={href}
      onClick={handleClick}
      className={className}
      {...(external
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : {})}
    >
      {children}
    </a>
  )
}

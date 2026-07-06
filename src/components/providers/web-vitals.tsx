'use client'

/**
 * Web Vitals reporter — sends LCP/INP/CLS/FCP/TTFB to /api/vitals.
 *
 * Usage in layout.tsx:
 *   <WebVitals />
 */

import { useEffect } from 'react'
import { onLCP, onINP, onCLS, onFCP, onTTFB, type Metric } from 'web-vitals'

export function WebVitals() {
  useEffect(() => {
    const report = (metric: Metric) => {
      fetch('/api/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: metric.name,
          value: metric.value,
          rating: metric.rating,
          id: metric.id,
        }),
        keepalive: true,
      }).catch(() => {})
    }

    onLCP(report)
    onINP(report)
    onCLS(report)
    onFCP(report)
    onTTFB(report)
  }, [])

  return null
}

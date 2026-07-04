/**
 * POST /api/vitals — receive Core Web Vitals from the browser.
 *
 * Issue #127: observes LCP/INP/CLS/FCP/TTFB into the Prometheus
 * webVitalsHistogram so dashboards can track p75 against budgets
 * (LCP <2.5s, INP <200ms, CLS <0.1). Non-blocking — always returns 204.
 */

import { NextRequest, NextResponse } from 'next/server'
import { webVitalsHistogram } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, value, rating, id } = body

    if (typeof name !== 'string' || typeof value !== 'number') {
      return new NextResponse(null, { status: 400 })
    }

    // Log vitals in dev for debugging
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[vitals] ${name}: ${Math.round(value)}ms (${rating}) id=${id}`)
    }

    // Issue #127: observe into Prometheus histogram.
    // CLS is unitless (0-1); LCP/INP/FCP/TTFB are in ms → convert to seconds.
    const isCls = name === 'CLS'
    const seconds = isCls ? value : value / 1000
    webVitalsHistogram.observe(
      { metric: name, rating: typeof rating === 'string' ? rating : 'unknown' },
      seconds
    )
  } catch {
    // Non-blocking — don't fail the request
  }

  return new NextResponse(null, { status: 204 })
}

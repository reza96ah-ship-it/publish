/**
 * POST /api/vitals â€” receive Core Web Vitals from the browser.
 *
 * Logs LCP, INP, CLS, FCP, TTFB to the server console (Prometheus in prod).
 * Non-blocking â€” always returns 204.
 */

import { NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, value, rating, id } = body

    // Log vitals (replace with Prometheus metrics in prod)
    if (process.env.NODE_ENV !== "production") {
      console.log(`[vitals] ${name}: ${Math.round(value)}ms (${rating}) id=${id}`)
    }

    // In production, push to Prometheus / Sentry
    // TODO: metrics.vitalsHistogram.observe({ name }, value)
  } catch {
    // Non-blocking â€” don't fail the request
  }

  return new NextResponse(null, { status: 204 })
}

/**
 * Issue #255: Public API v1 — aggregated analytics report.
 *
 *   GET /api/v1/reports?days=30  — totals + daily time-series for the
 *   token's workspace over the last `days` days (default 30, max 90).
 *   Requires scope `reports:read`.
 *
 * Days are zero-filled so consumers always get a contiguous range. The
 * `?days=` param is coerced + clamped server-side via a Zod schema.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiToken } from '@/lib/auth-guards'
import { publicApiRateLimit } from '@/lib/ratelimit'
import { validateParams } from '@/lib/validations'
import { publicApiService } from '@/modules/public-api'

export const dynamic = 'force-dynamic'

const reportQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(30),
})

function noStore(body: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(body, {
    ...(init?.status ? { status: init.status } : {}),
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function GET(req: NextRequest) {
  const guard = await requireApiToken(req, ['reports:read'])
  if (guard.error) return guard.error

  const rl = await publicApiRateLimit(guard.token.id)
  if (!rl.success) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'rate_limited', message: 'محدودیت نرخ درخواست فراتر رفته است' },
      { status: 429, headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' } }
    )
  }

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(reportQuerySchema, query)
  if (!queryCheck.success) return noStore({ error: queryCheck.error }, { status: 400 })

  const result = await publicApiService.getReport(
    guard.token.workspaceId,
    queryCheck.data.days
  )
  return noStore(result)
}

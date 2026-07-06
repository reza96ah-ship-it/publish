/**
 * Issue #255: Public API v1 — list publications.
 *
 *   GET /api/v1/publications  — cursor-paginated publications for the
 *   token's workspace. Requires scope `publications:read`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiToken } from '@/lib/auth-guards'
import { publicApiRateLimit } from '@/lib/ratelimit'
import { validateParams, cursorPaginationSchema } from '@/lib/validations'
import { publicApiService } from '@/modules/public-api'

export const dynamic = 'force-dynamic'

function noStore(body: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(body, {
    ...(init?.status ? { status: init.status } : {}),
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function GET(req: NextRequest) {
  const guard = await requireApiToken(req, ['publications:read'])
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
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) return noStore({ error: queryCheck.error }, { status: 400 })

  const result = await publicApiService.listPublications(
    guard.token.workspaceId,
    queryCheck.data
  )
  return noStore(result)
}

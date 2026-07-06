/**
 * Issue #255: Public API v1 — get a single content item.
 *
 *   GET /api/v1/content/[id]  — single content row for the token's workspace.
 *   Requires scope `content:read`. 404 if the id doesn't exist or belongs to
 *   another workspace (no information leak via 403).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiToken } from '@/lib/auth-guards'
import { publicApiRateLimit } from '@/lib/ratelimit'
import { validateId } from '@/lib/validations'
import { publicApiService } from '@/modules/public-api'

export const dynamic = 'force-dynamic'

function noStore(body: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(body, {
    ...(init?.status ? { status: init.status } : {}),
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiToken(req, ['content:read'])
  if (guard.error) return guard.error

  const rl = await publicApiRateLimit(guard.token.id)
  if (!rl.success) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'rate_limited', message: 'محدودیت نرخ درخواست فراتر رفته است' },
      { status: 429, headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' } }
    )
  }

  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return noStore({ error: idCheck.error }, { status: 400 })

  const item = await publicApiService.getContent(guard.token.workspaceId, idCheck.data)
  if (!item) {
    return noStore({ error: 'not_found', message: 'محتوا یافت نشد' }, { status: 404 })
  }
  return noStore(item)
}

/**
 * POST /api/members/invite — create a workspace invitation (Issue #143, #156).
 *
 * Thin transport handler: auth → rate-limit → validate → service.createInvitation() → map.
 *
 * The service (src/modules/membership/service.ts) owns all business logic:
 *   duplicate-member check, existing-invitation replace (resend),
 *   token generation, P2002 conflict handling, admin notification.
 *
 * The plaintext token is returned ONCE so the admin can send it to the
 * invitee. Only the hash is persisted.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, memberInviteSchema } from '@/lib/validations'
import { aiRateLimit } from '@/lib/ratelimit'
import { membershipService, MembershipError } from '@/modules/membership'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('member.invite')
  if (guard.error) return guard.error

  // Rate limit: reuse aiRateLimit (15 requests per minute per IP)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const { success: rateOk } = await aiRateLimit(ip)
  if (!rateOk) {
    return NextResponse.json({ error: 'تعداد درخواست‌ها بیش از حد مجاز است. کمی صبر کنید.' }, { status: 429 })
  }

  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })

  const validation = validateBody(memberInviteSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const result = await membershipService.createInvitation(
      { workspaceId: guard.workspaceId, userId: guard.userId, role: guard.role },
      validation.data
    )
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof MembershipError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}

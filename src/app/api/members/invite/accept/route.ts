/**
 * POST /api/members/invite/accept — accept a workspace invitation (Issue #143, #156).
 *
 * Thin transport handler: session → rate-limit → validate → service.acceptInvitation() → map.
 *
 * ASVS L2 V2.5.4 / V11.1.1: rate-limit auth-adjacent + business-flow endpoints.
 * Acceptance converts a one-time token into workspace membership — rate-limit
 * per user to defend against token-enumeration attempts and membership-flood
 * abuse (5 / 5 min / user matches the auth budget). The 256-bit token itself
 * is infeasible to brute-force, but defense-in-depth requires the limiter.
 *
 * The service (src/modules/membership/service.ts) owns all business logic:
 *   token hash lookup, validity (expired/revoked/accepted), email-match
 *   check, atomic accept (upsert member + mark invitation + revoke
 *   competitors), idempotent re-accept, audit log.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { authRateLimit } from '@/lib/ratelimit'
import { membershipService, MembershipError } from '@/modules/membership'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Must be authenticated (but not workspace-scoped — the token determines the workspace)
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'برای پذیرش دعوت‌نامه باید وارد شوید' }, { status: 401 })
  }

  // ASVS V2.5.4: rate-limit auth-adjacent endpoints. Per-user (not per-IP)
  // because the user is authenticated — sharing an IP across legitimate users
  // is common (corporate NAT), and a single attacker can rotate IPs easily.
  const { success: rateOk } = await authRateLimit(`invite-accept:${session.user.id}`)
  if (!rateOk) {
    return NextResponse.json(
      { error: 'تعداد تلاش‌ها زیاد است — چند دقیقه صبر کنید' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => null)
  if (!body?.token || typeof body.token !== 'string') {
    return NextResponse.json({ error: 'توکن دعوت‌نامه الزامی است' }, { status: 400 })
  }

  try {
    const result = await membershipService.acceptInvitation(
      {
        userId: (session.user as { id: string }).id,
        email: (session.user as { email?: string }).email ?? '',
        name: (session.user as { name?: string }).name ?? null,
      },
      { token: body.token }
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof MembershipError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}

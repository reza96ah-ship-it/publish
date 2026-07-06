/**
 * POST /api/auth/mfa/disable — disable MFA (requires current TOTP or backup code).
 *
 * Thin handler: auth → rate limit → identityService.disableMfa → response mapping.
 * Business logic lives in src/modules/identity (Issue #156).
 *
 * ASVS L2 V2.5.4 / V2.8.6: rate-limit auth-adjacent endpoints. The TOTP code
 * is 6 digits (1M combinations) — without rate limiting, an attacker who
 * steals a session cookie could brute-force the code offline. The 5 / 5 min
 * budget matches the verify route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { identityService, IdentityError } from '@/modules/identity'
import { authRateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ASVS V2.5.4: rate-limit auth-adjacent endpoints. Disable requires a TOTP
  // (or backup) code — cap at 5 / 5 min / user to prevent brute-force.
  const { success: rateOk } = await authRateLimit(`mfa-disable:${session.user.id}`)
  if (!rateOk) {
    return NextResponse.json(
      { error: 'تعداد تلاش‌ها زیاد است — چند دقیقه صبر کنید' },
      { status: 429 }
    )
  }

  const { code } = await req.json().catch(() => ({}))

  try {
    await identityService.disableMfa(
      { userId: session.user.id, email: session.user.email ?? '' },
      code
    )
    return NextResponse.json({ ok: true, message: 'MFA غیرفعال شد' })
  } catch (err) {
    if (err instanceof IdentityError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}

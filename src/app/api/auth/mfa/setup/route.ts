/**
 * POST /api/auth/mfa/setup — generate TOTP secret + QR code for MFA enrollment.
 *
 * Thin handler: auth → rate limit → identityService.setupMfa → response mapping.
 * Business logic lives in src/modules/identity (Issue #156).
 *
 * ASVS L2 V2.5.4 / V2.8.6: rate-limit auth-adjacent endpoints. Without this,
 * an authenticated attacker could spam MFA setup to mint pending secrets and
 * exhaust DB rows (DoS) or attempt to enumerate QR codes.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { identityService, IdentityError } from '@/modules/identity'
import { authRateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ASVS V2.5.4: rate-limit auth-adjacent endpoints. Setup writes a pending
  // secret + QR to the DB on every call — cap at 5 / 5 min / user (same budget
  // as the verify route) to prevent DoS and QR-code enumeration.
  const { success: rateOk } = await authRateLimit(`mfa-setup:${session.user.id}`)
  if (!rateOk) {
    return NextResponse.json(
      { error: 'تعداد تلاش‌ها زیاد است — چند دقیقه صبر کنید' },
      { status: 429 }
    )
  }

  try {
    const result = await identityService.setupMfa({
      userId: session.user.id,
      email: session.user.email ?? '',
    })
    return NextResponse.json({
      ...result,
      message: 'کد QR را با اپلیکیشن احراز هویت اسکن کنید، سپس کد ۶ رقمی را تأیید کنید.',
    })
  } catch (err) {
    if (err instanceof IdentityError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}

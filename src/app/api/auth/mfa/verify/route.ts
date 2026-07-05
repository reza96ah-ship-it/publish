/**
 * POST /api/auth/mfa/verify — verify TOTP code and activate MFA.
 *
 * Thin handler: auth → rate limit → identityService.verifyMfa → response mapping.
 * Business logic lives in src/modules/identity (Issue #156). Backup codes are
 * returned ONCE — the user must save them.
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
    return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  }

  const { success: rateOk } = await authRateLimit(session.user.id)
  if (!rateOk) {
    return NextResponse.json(
      { error: 'تعداد تلاش‌ها زیاد است — چند دقیقه صبر کنید' },
      { status: 429 }
    )
  }

  const { code } = await req.json().catch(() => ({}))

  try {
    const { backupCodes } = await identityService.verifyMfa(
      { userId: session.user.id, email: session.user.email ?? '' },
      code
    )
    return NextResponse.json({
      ok: true,
      backupCodes,
      message:
        'MFA فعال شد. کدهای پشتیبان را در جای امن ذخیره کنید — برای دسترسی اضطراری استفاده می‌شوند.',
    })
  } catch (err) {
    if (err instanceof IdentityError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}

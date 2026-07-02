/**
 * POST /api/auth/mfa/setup — generate TOTP secret + QR code for MFA enrollment.
 *
 * Thin handler: auth → identityService.setupMfa → response mapping.
 * Business logic lives in src/modules/identity (Issue #156).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { identityService, IdentityError } from '@/modules/identity'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
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

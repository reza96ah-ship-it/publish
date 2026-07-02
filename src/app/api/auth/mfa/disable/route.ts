/**
 * POST /api/auth/mfa/disable — disable MFA (requires current TOTP or backup code).
 *
 * Thin handler: auth → identityService.disableMfa → response mapping.
 * Business logic lives in src/modules/identity (Issue #156).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { identityService, IdentityError } from '@/modules/identity'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
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

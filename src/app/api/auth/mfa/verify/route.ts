/**
 * POST /api/auth/mfa/verify — verify TOTP code and activate MFA.
 *
 * Flow (Issue #121):
 *   1. User enters 6-digit code from authenticator app
 *   2. Verify against mfaSecretPending
 *   3. If valid: move secret to mfaSecret (active), generate backup codes,
 *      set mfaEnabledAt
 *   4. Return backup codes (shown ONCE — user must save them)
 *
 * Requires authenticated session + pending MFA secret.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  verifyTotpCode,
  decryptMfaSecret,
  generateBackupCodes,
  serializeBackupCodes,
} from '@/lib/mfa'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { code } = await req.json().catch(() => ({}))
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'کد تأیید الزامی است' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { mfaSecretPending: true, mfaSecret: true },
  })
  if (!user?.mfaSecretPending) {
    return NextResponse.json(
      { error: 'ابتدا مرحله راه‌اندازی MFA را انجام دهید' },
      { status: 400 }
    )
  }

  // Decrypt pending secret and verify the TOTP code
  const secret = decryptMfaSecret(user.mfaSecretPending)
  if (!verifyTotpCode(code, secret)) {
    return NextResponse.json({ error: 'کد تأیید نامعتبر است' }, { status: 400 })
  }

  // Generate backup codes (shown once)
  const { plaintext, hashed } = generateBackupCodes()

  // Activate MFA: move pending secret to active + store backup code hashes
  await db.user.update({
    where: { id: userId },
    data: {
      mfaSecret: user.mfaSecretPending,
      mfaSecretPending: null,
      mfaBackupCodes: serializeBackupCodes(hashed),
      mfaEnabledAt: new Date(),
    },
  })

  return NextResponse.json({
    ok: true,
    backupCodes: plaintext,
    message:
      'MFA فعال شد. کدهای پشتیبان را در جای امن ذخیره کنید — برای دسترسی اضطراری استفاده می‌شوند.',
  })
}

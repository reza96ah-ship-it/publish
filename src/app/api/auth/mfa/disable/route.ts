/**
 * POST /api/auth/mfa/disable — disable MFA (requires current TOTP code).
 *
 * Flow (Issue #121):
 *   1. User enters current TOTP code (or backup code) to confirm
 *   2. Verify against active mfaSecret
 *   3. If valid: clear mfaSecret, mfaBackupCodes, mfaEnabledAt
 *
 * Requires authenticated session + active MFA.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  verifyTotpCode,
  decryptMfaSecret,
  parseBackupCodes,
  consumeBackupCode,
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
    select: { mfaSecret: true, mfaBackupCodes: true },
  })
  if (!user?.mfaSecret) {
    return NextResponse.json({ error: 'MFA فعال نیست' }, { status: 400 })
  }

  const secret = decryptMfaSecret(user.mfaSecret)
  const isValidTotp = verifyTotpCode(code, secret)

  let backupCodesRemaining = user.mfaBackupCodes
  if (!isValidTotp) {
    // Try backup code
    const stored = parseBackupCodes(user.mfaBackupCodes)
    const { valid, remaining } = consumeBackupCode(code, stored)
    if (!valid) {
      return NextResponse.json({ error: 'کد تأیید یا کد پشتیبان نامعتبر است' }, { status: 400 })
    }
    backupCodesRemaining = serializeBackupCodes(remaining)
  }

  // Disable MFA: clear all MFA fields
  await db.user.update({
    where: { id: userId },
    data: {
      mfaSecret: null,
      mfaSecretPending: null,
      mfaBackupCodes: null,
      mfaEnabledAt: null,
    },
  })

  return NextResponse.json({ ok: true, message: 'MFA غیرفعال شد' })
}

/**
 * POST /api/auth/mfa/setup — generate TOTP secret + QR code for MFA enrollment.
 *
 * Flow (Issue #121):
 *   1. User (admin) requests MFA setup
 *   2. Generate TOTP secret, store encrypted as mfaSecretPending
 *   3. Return QR data URL + otpauth URI for authenticator app
 *   4. User scans QR, enters 6-digit code at /api/auth/mfa/verify to activate
 *
 * Requires authenticated session. Only the user themselves can set up MFA.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  generateMfaSecret,
  buildOtpAuthUri,
  generateQrCodeDataUrl,
  encryptMfaSecret,
} from '@/lib/mfa'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const email = session.user.email ?? ''

  // Generate a new TOTP secret
  const secret = generateMfaSecret()
  const otpauthUri = buildOtpAuthUri(email, secret)
  const qrDataUrl = await generateQrCodeDataUrl(otpauthUri)

  // Store encrypted as pending (not active until verified)
  await db.user.update({
    where: { id: userId },
    data: { mfaSecretPending: encryptMfaSecret(secret) },
  })

  return NextResponse.json({
    qrDataUrl,
    otpauthUri,
    secret, // shown as text fallback in case QR scan fails
    message: 'کد QR را با اپلیکیشن احراز هویت اسکن کنید، سپس کد ۶ رقمی را تأیید کنید.',
  })
}

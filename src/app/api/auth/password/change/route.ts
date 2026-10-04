import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { authRateLimit } from '@/lib/ratelimit'
import { decryptMfaSecret, verifyTotpCode } from '@/lib/mfa'
import { hashPassword, verifyPassword } from '@/lib/password'
import { isStrongAppPassword } from '@/lib/password-policy'

export const dynamic = 'force-dynamic'

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
  totpCode: z.string().trim().max(32).optional(),
}).strict()

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const baseUrl = process.env.NEXTAUTH_URL
  if (!baseUrl || req.headers.get('origin') !== new URL(baseUrl).origin ||
      !req.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'invalid origin or content type' }, { status: 403 })
  }

  const limit = await authRateLimit(`password-change:${session.user.id}`)
  if (!limit.success) return NextResponse.json({ error: 'تعداد تلاش‌ها زیاد است' }, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success || !isStrongAppPassword(parsed.data.newPassword, session.user.email ?? '') ||
      parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json({ error: 'رمز عبور جدید نامعتبر یا تکراری است' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, passwordHash: true, mfaSecret: true, lockedUntil: true },
  })
  if (!user?.passwordHash || user.email !== session.user.email ||
      (user.lockedUntil && user.lockedUntil > new Date())) {
    return NextResponse.json({ error: 'تغییر رمز عبور ممکن نیست؛ دوباره وارد شوید' }, { status: 403 })
  }
  const current = await verifyPassword(parsed.data.currentPassword, user.passwordHash)
  if (!current.valid) return NextResponse.json({ error: 'رمز فعلی یا کد دومرحله‌ای نامعتبر است' }, { status: 400 })
  if (user.mfaSecret && (!parsed.data.totpCode ||
      !verifyTotpCode(parsed.data.totpCode, decryptMfaSecret(user.mfaSecret)))) {
    return NextResponse.json({ error: 'رمز فعلی یا کد دومرحله‌ای نامعتبر است' }, { status: 400 })
  }

  const passwordHash = await hashPassword(parsed.data.newPassword)
  const updated = await db.user.updateMany({
    where: { id: user.id, passwordHash: user.passwordHash },
    data: { passwordHash, sessionVersion: { increment: 1 }, failedAttempts: 0, lockedUntil: null },
  })
  if (updated.count !== 1) return NextResponse.json({ error: 'حساب تغییر کرد؛ دوباره تلاش کنید' }, { status: 409 })
  await db.auditLog.create({
    data: { userId: user.id, action: 'account.password_changed', resource: 'User' },
  }).catch(() => undefined)
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}

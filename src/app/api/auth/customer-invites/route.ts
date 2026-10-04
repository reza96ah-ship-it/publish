import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { authRateLimit } from '@/lib/ratelimit'
import { normalizeEmail } from '@/lib/invitations'
import { CustomerInvitationError, issueCustomerInvitation, listCustomerInvitations, revokeCustomerInvitation } from '@/lib/customer-invitations'

export const dynamic = 'force-dynamic'

const schema = z.object({
  email: z.email().max(254),
  workspaceName: z.string().trim().min(2).max(80),
}).strict()

async function ownerId(): Promise<string | null> {
  const ownerEmail = normalizeEmail(process.env.PLATFORM_OWNER_EMAIL ?? '')
  const session = await getServerSession(authOptions)
  if (!ownerEmail || !session?.user?.id || normalizeEmail(session.user.email ?? '') !== ownerEmail) {
    return null
  }
  const owner = await db.user.findUnique({ where: { id: session.user.id }, select: { email: true, mfaSecret: true, sessionVersion: true } })
  // Existing accounts start at version 0. The password-change route increments
  // this version and revokes prior sessions, so invitation issuance stays closed
  // until the operator has replaced any shared/test app password.
  if (!owner?.mfaSecret || owner.sessionVersion < 1 || normalizeEmail(owner.email ?? '') !== ownerEmail) return null
  return session.user.id
}

function sameOriginJson(req: NextRequest): boolean {
  const baseUrl = process.env.NEXTAUTH_URL
  if (!baseUrl) return false
  return req.headers.get('origin') === new URL(baseUrl).origin &&
    Boolean(req.headers.get('content-type')?.startsWith('application/json'))
}

export async function POST(req: NextRequest) {
  const userId = await ownerId()
  if (!userId) return NextResponse.json({ error: 'forbidden or MFA required' }, { status: 403 })
  const baseUrl = process.env.NEXTAUTH_URL
  if (!baseUrl) return NextResponse.json({ error: 'app URL not configured' }, { status: 503 })
  if (!sameOriginJson(req)) {
    return NextResponse.json({ error: 'invalid origin or content type' }, { status: 403 })
  }
  const limit = await authRateLimit(`customer-invite-issue:${userId}`)
  if (!limit.success) return NextResponse.json({ error: 'تعداد تلاش‌ها زیاد است' }, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'نام فضای کاری یا ایمیل نامعتبر است' }, { status: 400 })

  try {
    const issued = await issueCustomerInvitation({ ownerId: userId, ...parsed.data })
    const inviteUrl = new URL('/auth/customer-invite', baseUrl)
    inviteUrl.hash = `token=${encodeURIComponent(issued.token)}`
    return NextResponse.json({ email: issued.email, expiresAt: issued.expiresAt, inviteUrl: inviteUrl.toString() }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    })
  } catch (error) {
    if (error instanceof CustomerInvitationError) return NextResponse.json({ error: error.message }, { status: error.status })
    throw error
  }
}

export async function GET() {
  const userId = await ownerId()
  if (!userId) return NextResponse.json({ error: 'forbidden or MFA required' }, { status: 403 })
  const invitations = await listCustomerInvitations(userId)
  return NextResponse.json({ invitations }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(req: NextRequest) {
  const userId = await ownerId()
  if (!userId) return NextResponse.json({ error: 'forbidden or MFA required' }, { status: 403 })
  if (!sameOriginJson(req)) return NextResponse.json({ error: 'invalid origin or content type' }, { status: 403 })
  const parsed = z.object({ invitationId: z.string().min(1).max(100) }).strict().safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid invitation' }, { status: 400 })
  try {
    await revokeCustomerInvitation(userId, parsed.data.invitationId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof CustomerInvitationError) return NextResponse.json({ error: error.message }, { status: error.status })
    throw error
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authRateLimit } from '@/lib/ratelimit'
import { hashToken } from '@/lib/invitations'
import { acceptCustomerInvitation, CustomerInvitationError } from '@/lib/customer-invitations'

export const dynamic = 'force-dynamic'

const schema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  email: z.email().max(254),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(128),
}).strict().refine((value) => {
  const password = value.password.toLowerCase()
  const emailName = value.email.toLowerCase().split('@')[0]
  return !password.includes(value.email.toLowerCase()) &&
    !(emailName.length >= 4 && password.includes(emailName)) &&
    !/^(.)\1+$/.test(password) &&
    !['password', 'qwerty', '123456', 'adminadmin'].some((weak) => password.includes(weak))
}, {
  message: 'رمز عبور بسیار ساده است',
})

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== new URL(process.env.NEXTAUTH_URL ?? req.url).origin ||
      !req.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'invalid origin or content type' }, { status: 403 })
  }
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'اطلاعات دعوت یا رمز عبور نامعتبر است' }, { status: 400 })
  // Key the budget to the invite, not a client-supplied forwarding header.
  // A leaked link cannot bypass this cap by rotating/spoofing its IP address.
  const limit = await authRateLimit(`customer-invite-accept:${hashToken(parsed.data.token)}`)
  if (!limit.success) return NextResponse.json({ error: 'تعداد تلاش‌ها زیاد است' }, { status: 429 })
  try {
    const result = await acceptCustomerInvitation(parsed.data)
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof CustomerInvitationError) return NextResponse.json({ error: error.message }, { status: error.status })
    throw error
  }
}

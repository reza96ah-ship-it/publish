import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { authRateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

const handler = NextAuth(authOptions)

/**
 * ASVS L2 V2.5.4: rate-limit the credentials login endpoint per IP.
 *
 * NextAuth v4 does not expose a clean hook to rate-limit only the credentials
 * callback, so we wrap the POST handler. The per-user lockout (5 failed
 * attempts → 15 min lock, in src/lib/auth.ts) provides defense-in-depth.
 *
 * Budget: 5 attempts / 5 min / IP (matches `authRateLimit`).
 *
 * Also: next-auth v4 dispatches between App Router and legacy Pages Router
 * based on `context.params`. Under Next.js 16 standalone server, params can
 * be undefined, causing a crash. We always pass resolved params.
 */
async function route(
  req: NextRequest,
  ctx: { params?: Promise<{ nextauth?: string[] }> }
) {
  // Resolve nextauth segments from URL if context params are missing
  let nextauth = (await ctx?.params)?.nextauth
  if (!nextauth || nextauth.length === 0) {
    const afterAuth = new URL(req.url).pathname.split('/api/auth/')[1] ?? ''
    nextauth = afterAuth.split('/').filter(Boolean)
  }

  // Rate limit only the credentials callback POST
  if (req.method === 'POST' && nextauth.join('/') === 'callback/credentials') {
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
    const { success: rateOk } = await authRateLimit(`login:${ip}`)
    if (!rateOk) {
      return NextResponse.json(
        { error: 'تعداد تلاش‌های ورود زیاد است. چند دقیقه صبر کنید.' },
        { status: 429 }
      )
    }
  }

  return handler(req, { params: { nextauth } })
}

export { route as GET, route as POST }

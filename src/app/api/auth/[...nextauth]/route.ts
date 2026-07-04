import NextAuth from 'next-auth'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { authRateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

const handler = NextAuth(authOptions)

/**
 * ASVS L2 V2.5.4: rate-limit the credentials login endpoint per IP.
 *
 * NextAuth v4 does not expose a clean hook to rate-limit only the credentials
 * callback, so we wrap the POST handler. The wrapper inspects the URL
 * pathname WITHOUT reading the request body (so NextAuth still sees the
 * credentials). The per-user lockout (5 failed attempts → 15 min lock, in
 * src/lib/auth.ts) provides defense-in-depth on top of the per-IP limiter.
 *
 * Budget: 5 attempts / 5 min / IP (matches `authRateLimit`).
 *
 * Other NextAuth POSTs (`/api/auth/signout`, `/api/auth/session`) are not
 * rate-limited — they are session-bearing actions, not credential checks.
 */
async function rateLimitedPost(req: NextRequest) {
  const path = req.nextUrl.pathname
  // Match `/api/auth/callback/credentials` exactly (no trailing segments).
  if (path.endsWith('/api/auth/callback/credentials') || path === '/api/auth/callback/credentials') {
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = (forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown')
    const { success: rateOk } = await authRateLimit(`login:${ip}`)
    if (!rateOk) {
      return NextResponse.json(
        { error: 'تعداد تلاش‌های ورود زیاد است. چند دقیقه صبر کنید.' },
        { status: 429 }
      )
    }
  }
  return handler(req)
}

export { handler as GET, rateLimitedPost as POST }

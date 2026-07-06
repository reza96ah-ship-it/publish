/**
 * GET /api/auth/clear-session — self-heal for stale sessions.
 *
 * When a session cookie decodes but its user/workspace no longer exists
 * (e.g. after a database reset), the app used to bounce forever between
 * /auth/signin (sees a session → redirect to /) and requireWorkspace()
 * (no membership → redirect to signin), bricking the browser until the
 * user manually cleared cookies. requireWorkspace() now sends stale
 * sessions here instead: the NextAuth cookies are force-expired and the
 * user lands on a working signin page.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SESSION_COOKIES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
]

export async function GET(req: Request) {
  const res = NextResponse.redirect(
    new URL('/auth/signin?error=SessionExpired', req.url)
  )
  for (const name of SESSION_COOKIES) {
    res.cookies.set(name, '', { maxAge: 0, path: '/' })
  }
  return res
}

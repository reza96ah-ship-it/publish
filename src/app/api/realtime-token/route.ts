/**
 * BUG-02: Issue a short-lived HS256 JWT for socket.io realtime auth.
 *
 * NextAuth v4 encrypts session tokens as JWE (A256CBC-HS512) — the raw token
 * is never available on the client side via useSession(). This endpoint runs
 * server-side, extracts the session, and issues a compact HS256 JWT that the
 * realtime service can verify with the same NEXTAUTH_SECRET.
 *
 * Token lifetime: 1 hour (realtime connections refresh on reconnect).
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createHmac } from 'crypto'

export const dynamic = 'force-dynamic'

const NEXTAUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'nashrino-dev-secret-change-in-production'

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function issueRealtimeJwt(userId: string, activeWorkspaceId: string | null): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64UrlEncode(
    JSON.stringify({
      userId,
      activeWorkspaceId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    })
  )
  const signature = createHmac('sha256', NEXTAUTH_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${signature}`
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id as string
  const activeWorkspaceId = (session as any).activeWorkspaceId as string | null

  if (!userId) {
    return NextResponse.json({ error: 'invalid session' }, { status: 401 })
  }

  const token = issueRealtimeJwt(userId, activeWorkspaceId)
  return NextResponse.json({ token })
}

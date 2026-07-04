/**
 * GET /api/platforms/oauth/start?type=instagram|linkedin
 *
 * Kicks off the OAuth flow. The service (src/modules/oauth/service.ts) builds
 * the provider authorization URL + state cookie payload; this handler just
 * applies the redirect and sets the cookie. (Issue #200: thin handler.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { oauthService } from '@/modules/oauth'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('platform.connect')
  if (guard.error) {
    return NextResponse.redirect(new URL('/channels?oauth_error=auth_failed', BASE_URL))
  }

  const type = req.nextUrl.searchParams.get('type') ?? ''
  const result = await oauthService.start({
    workspaceId: guard.workspaceId,
    userId: guard.userId,
    type,
    baseUrl: BASE_URL,
  })

  if (!result.ok) {
    return NextResponse.redirect(new URL(result.redirectUrl, BASE_URL))
  }

  const response = NextResponse.redirect(result.authorizationUrl)
  response.cookies.set(result.cookieName, result.cookiePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: result.cookieMaxAge,
    path: '/',
  })
  return response
}

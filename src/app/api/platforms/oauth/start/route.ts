/**
 * GET /api/platforms/oauth/start?type=instagram|linkedin
 *
 * Kicks off the OAuth flow. Creates (or reuses) the platform record,
 * builds the provider authorization URL, stores state+codeVerifier in
 * a short-lived HTTP-only cookie, then redirects to the provider.
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { getProviderAuthAdapter } from '@/lib/provider-auth'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
const REDIRECT_URI = `${BASE_URL}/api/platforms/oauth/callback`

const CLIENT_ID_MAP: Record<string, string | undefined> = {
  instagram: process.env.INSTAGRAM_CLIENT_ID,
  linkedin: process.env.LINKEDIN_CLIENT_ID,
}

const PLATFORM_NAMES: Record<string, string> = {
  instagram: 'اینستاگرام',
  linkedin: 'لینکدین',
}

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('platform.connect')
  if (guard.error) return NextResponse.redirect(new URL('/channels?oauth_error=auth_failed', BASE_URL))

  const type = req.nextUrl.searchParams.get('type') ?? ''
  const adapter = getProviderAuthAdapter(type)

  if (!adapter || !('getAuthorizationUrl' in adapter)) {
    return NextResponse.redirect(
      new URL(`/channels?oauth_error=unsupported_type&type=${type}`, BASE_URL)
    )
  }

  const clientId = CLIENT_ID_MAP[type]
  if (!clientId) {
    const envVar = type === 'instagram' ? 'INSTAGRAM_CLIENT_ID' : 'LINKEDIN_CLIENT_ID'
    return NextResponse.redirect(
      new URL(
        `/channels?oauth_error=${encodeURIComponent(`${envVar} is not set in .env`)}`,
        BASE_URL
      )
    )
  }

  // Reuse existing platform of this type, or create a new one
  let platform = await db.platform.findFirst({
    where: { workspaceId: guard.workspaceId, type },
  })
  if (!platform) {
    platform = await db.platform.create({
      data: {
        workspaceId: guard.workspaceId,
        type,
        name: PLATFORM_NAMES[type] ?? type,
        status: 'disconnected',
        accountKind: 'professional',
        circuitState: 'closed',
      },
    })
  }

  const state = randomBytes(16).toString('hex')

  const getAuthorizationUrl = adapter.getAuthorizationUrl
  if (!getAuthorizationUrl) {
    return NextResponse.redirect(
      new URL(`/channels?oauth_error=unsupported_type&type=${type}`, BASE_URL)
    )
  }
  const { authorizationUrl, codeVerifier } = await getAuthorizationUrl({
    workspaceId: guard.workspaceId,
    redirectUri: REDIRECT_URI,
    state,
    platformId: platform.id,
  })

  // Store state → {platformId, codeVerifier} in a short-lived cookie so the callback can use it
  const cookiePayload = JSON.stringify({
    platformId: platform.id,
    codeVerifier: codeVerifier ?? null,
    type,
  })

  const response = NextResponse.redirect(authorizationUrl)
  response.cookies.set(`oauth_state_${state}`, cookiePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15, // 15 minutes
    path: '/',
  })
  return response
}

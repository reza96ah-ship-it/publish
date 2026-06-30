/**
 * GET /api/platforms/oauth/callback?code=xxx&state=xxx
 *
 * OAuth callback handler. Reads the state cookie written by /oauth/start,
 * exchanges the authorization code for tokens, saves them, then redirects
 * back to /channels with a success or error indicator.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { getProviderAuthAdapter } from '@/lib/provider-auth'
import { computeCredentialStatus } from '@/lib/provider-auth/types'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
const REDIRECT_URI = `${BASE_URL}/api/platforms/oauth/callback`

function redirectError(msg: string) {
  return NextResponse.redirect(
    new URL(`/channels?oauth_error=${encodeURIComponent(msg)}`, BASE_URL)
  )
}

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('platform.connect')
  if (guard.error) return redirectError('auth_failed')

  // Provider returned an error (user denied consent, etc.)
  const errorParam = req.nextUrl.searchParams.get('error')
  if (errorParam) {
    const desc = req.nextUrl.searchParams.get('error_description') || errorParam
    return redirectError(desc)
  }

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  if (!code || !state) return redirectError('missing_code_or_state')

  // Retrieve the state cookie written by /oauth/start
  const cookieName = `oauth_state_${state}`
  const rawCookie = req.cookies.get(cookieName)?.value
  if (!rawCookie) return redirectError('invalid_or_expired_state')

  let platformId: string, codeVerifier: string | null, type: string
  try {
    ;({ platformId, codeVerifier, type } = JSON.parse(rawCookie))
  } catch {
    return redirectError('corrupt_state_cookie')
  }

  // Verify the platform belongs to this workspace
  const platform = await db.platform.findFirst({
    where: { id: platformId, workspaceId: guard.workspaceId },
  })
  if (!platform) return redirectError('platform_not_found')

  const adapter = getProviderAuthAdapter(type)
  if (!adapter || !('exchangeCode' in adapter)) return redirectError('adapter_not_found')

  let response: NextResponse
  try {
    const credential = await (adapter as any).exchangeCode({
      code,
      redirectUri: REDIRECT_URI,
      codeVerifier: codeVerifier ?? undefined,
    })

    const credentialStatus = computeCredentialStatus(
      { status: 'active', canPublish: true, message: '', missingScopes: [], validatedAt: new Date() },
      credential.expiresAt ?? null
    )

    await db.platform.update({
      where: { id: platformId },
      data: {
        tokenSecret: credential.accessTokenEncrypted,
        targetId: credential.accountId || null,
        name: credential.accountName || platform.name,
        username: credential.accountName || credential.accountId || '',
        status: credentialStatus,
        tokenExpiresAt: credential.expiresAt ?? null,
        tokenScopes: credential.scopes?.join(',') ?? null,
        lastError: null,
        lastValidatedAt: new Date(),
        circuitState: 'closed',
      },
    })

    try {
      await db.auditLog.create({
        data: {
          userId: guard.userId,
          workspaceId: guard.workspaceId,
          action: 'platform.connected',
          resource: 'Platform',
          metadata: {
            platformId,
            platformType: type,
            accountId: credential.accountId,
            scopes: credential.scopes,
            expiresAt: credential.expiresAt?.toISOString() ?? null,
          },
        },
      })
    } catch { /* audit write failure is non-fatal */ }

    response = NextResponse.redirect(new URL('/channels?oauth_success=1', BASE_URL))
  } catch (err: any) {
    response = redirectError(err.message || 'token_exchange_failed')
  }

  // Clear the state cookie regardless of outcome
  response.cookies.delete(cookieName)
  return response
}

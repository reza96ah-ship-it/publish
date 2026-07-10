/**
 * Issue #200: OAuth domain module — service layer.
 *
 * Encapsulates the OAuth start + callback flow so the route handlers stay
 * thin (auth → service.start/handle → redirect + cookie set/clear).
 *
 * The service does NOT touch Next.js transport objects (no NextResponse /
 * no cookie API). It returns structured results that the route handler
 * turns into redirects + cookies.
 */

import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { getProviderAuthAdapter } from '@/lib/provider-auth'
import { isPlatformEnabled } from '@/lib/provider-capabilities'
import { computeCredentialStatus } from '@/lib/provider-auth/types'
import type {
  StartOAuthInput,
  StartOAuthResult,
  CallbackInput,
  CallbackResult,
} from './types'

const REDIRECT_PATH = '/api/platforms/oauth/callback'
const STATE_COOKIE_TTL_SEC = 60 * 15 // 15 minutes
const CLIENT_ID_MAP: Record<string, string | undefined> = {
  instagram: process.env.INSTAGRAM_CLIENT_ID,
  linkedin: process.env.LINKEDIN_CLIENT_ID,
}
const PLATFORM_NAMES: Record<string, string> = {
  instagram: 'اینستاگرام',
  linkedin: 'لینکدین',
}

function redirectUri(baseUrl: string): string {
  return `${baseUrl}${REDIRECT_PATH}`
}

function errorUrl(baseUrl: string, code: string): string {
  return `/channels?oauth_error=${encodeURIComponent(code)}`
}

export class OAuthService {
  /**
   * GET /api/platforms/oauth/start — kick off the OAuth flow.
   *
   * Reuses an existing Platform row of this type for the workspace, or
   * creates a new one. Generates a CSRF state token + PKCE verifier (if the
   * adapter produces one) and returns the cookie payload the route handler
   * must persist before redirecting the user to the provider.
   */
  async start(input: StartOAuthInput): Promise<StartOAuthResult> {
    const { workspaceId, type, baseUrl } = input

    if (!isPlatformEnabled(type)) {
      return { ok: false, redirectUrl: `/channels?oauth_error=unsupported_type&type=${type}` }
    }

    const adapter = getProviderAuthAdapter(type)
    if (!adapter || !('getAuthorizationUrl' in adapter) || !adapter.getAuthorizationUrl) {
      return { ok: false, redirectUrl: `/channels?oauth_error=unsupported_type&type=${type}` }
    }

    const clientId = CLIENT_ID_MAP[type]
    if (!clientId) {
      const envVar = type === 'instagram' ? 'INSTAGRAM_CLIENT_ID' : 'LINKEDIN_CLIENT_ID'
      return { ok: false, redirectUrl: errorUrl(baseUrl, `${envVar} is not set in .env`) }
    }

    // Reuse existing platform of this type, or create a new one
    let platform = await db.platform.findFirst({ where: { workspaceId, type } })
    if (!platform) {
      platform = await db.platform.create({
        data: {
          workspaceId,
          type,
          name: PLATFORM_NAMES[type] ?? type,
          status: 'disconnected',
          accountKind: 'professional',
          circuitState: 'closed',
        },
      })
    }

    const state = randomBytes(16).toString('hex')
    const { authorizationUrl, codeVerifier } = await adapter.getAuthorizationUrl({
      workspaceId,
      redirectUri: redirectUri(baseUrl),
      state,
      platformId: platform.id,
    })

    const cookiePayload = JSON.stringify({
      platformId: platform.id,
      codeVerifier: codeVerifier ?? null,
      type,
    })

    return {
      ok: true,
      authorizationUrl,
      cookieName: `oauth_state_${state}`,
      cookiePayload,
      cookieMaxAge: STATE_COOKIE_TTL_SEC,
    }
  }

  /**
   * GET /api/platforms/oauth/callback — exchange the auth code for tokens.
   *
   * Reads the state cookie written by /oauth/start, verifies the platform
   * belongs to this workspace, exchanges the code via the adapter, persists
   * the credential, writes an audit log entry, and returns the final redirect
   * URL + the cookie name to clear.
   */
  async handleCallback(input: CallbackInput): Promise<CallbackResult> {
    const { workspaceId, userId, code, state, providerError, providerErrorDescription, cookieValue, baseUrl } = input

    // Provider returned an error (user denied consent, etc.)
    if (providerError) {
      const desc = providerErrorDescription || providerError
      return { redirectUrl: errorUrl(baseUrl, desc), clearCookieName: '' }
    }
    if (!code || !state) {
      return { redirectUrl: errorUrl(baseUrl, 'missing_code_or_state'), clearCookieName: '' }
    }

    const cookieName = `oauth_state_${state}`
    if (!cookieValue) {
      return { redirectUrl: errorUrl(baseUrl, 'invalid_or_expired_state'), clearCookieName: cookieName }
    }

    let platformId: string, codeVerifier: string | null, type: string
    try {
      ;({ platformId, codeVerifier, type } = JSON.parse(cookieValue))
    } catch {
      return { redirectUrl: errorUrl(baseUrl, 'corrupt_state_cookie'), clearCookieName: cookieName }
    }

    // Verify the platform belongs to this workspace
    const platform = await db.platform.findFirst({ where: { id: platformId, workspaceId } })
    if (!platform) {
      return { redirectUrl: errorUrl(baseUrl, 'platform_not_found'), clearCookieName: cookieName }
    }

    const adapter = getProviderAuthAdapter(type)
    if (!adapter || !('exchangeCode' in adapter) || !adapter.exchangeCode) {
      return { redirectUrl: errorUrl(baseUrl, 'adapter_not_found'), clearCookieName: cookieName }
    }

    try {
      const credential = await adapter.exchangeCode({
        code,
        state,
        redirectUri: redirectUri(baseUrl),
        codeVerifier: codeVerifier ?? undefined,
      })

      const credentialStatus = computeCredentialStatus(
        { status: 'active', canPublish: true, message: '', missingScopes: [], validatedAt: new Date() },
        credential.expiresAt ?? null,
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
            userId,
            workspaceId,
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

      return { redirectUrl: '/channels?oauth_success=1', clearCookieName: cookieName }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'token_exchange_failed'
      return { redirectUrl: errorUrl(baseUrl, msg), clearCookieName: cookieName }
    }
  }
}

export const oauthService = new OAuthService()

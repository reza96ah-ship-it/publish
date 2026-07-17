/**
 * Issue #144: OAuth provider auth adapters (Instagram + LinkedIn).
 *
 * These adapters implement the full OAuth flow:
 *   1. getAuthorizationUrl → user visits provider consent page
 *   2. exchangeCode → server exchanges code for access+refresh tokens
 *   3. validateCredential → contacts provider API to verify real expiry + scopes
 *
 * Before: connect route set `valid = true` without contacting IG/LinkedIn.
 * After: IG/LinkedIn CANNOT become active without successful provider validation.
 *
 * Graph API version is configurable via INSTAGRAM_GRAPH_API_VERSION env var.
 * LinkedIn version via LINKEDIN_API_VERSION (default: 202505).
 */

import type {
  ProviderAuthAdapter,
  ProviderCredential,
  CredentialHealth,
  AuthStartInput,
  AuthStartResult,
  AuthCallbackInput,
} from './types'
import { encrypt, getActiveKeyId } from '../crypto'
import { REQUIRED_SCOPES } from './types'
import {
  getInstagramGraphApiBaseUrl,
  INSTAGRAM_AUTH_API_ORIGIN,
  INSTAGRAM_GRAPH_API_ORIGIN,
} from '../../../shared/instagram-graph'

// ── Instagram API with Instagram Login (2024+ path) ───────────
// Auth flow:   api.instagram.com/oauth/authorize  (no Facebook Page required)
// Token exch:  api.instagram.com/oauth/access_token (short-lived)
// Long-lived:  graph.instagram.com/access_token?grant_type=ig_exchange_token
// API calls:   graph.instagram.com/{version}/{endpoint}

const IG_GRAPH_API = getInstagramGraphApiBaseUrl()
const IG_AUTH_API = INSTAGRAM_AUTH_API_ORIGIN

const IG_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID || ''
const IG_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET || ''

export class InstagramAuthAdapter implements ProviderAuthAdapter {
  readonly provider = 'instagram' as const

  async getAuthorizationUrl(input: AuthStartInput): Promise<AuthStartResult> {
    const scopes = REQUIRED_SCOPES.instagram.join(',')
    const params = new URLSearchParams({
      client_id: IG_CLIENT_ID,
      redirect_uri: input.redirectUri,
      response_type: 'code',
      scope: scopes,
      state: input.state,
    })
    // PKCE: always required — auto-generate verifier if caller didn't supply one
    const { createHash, randomBytes } = await import('crypto')
    const codeVerifier = input.codeVerifier ?? randomBytes(32).toString('base64url')
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
    params.set('code_challenge', codeChallenge)
    params.set('code_challenge_method', 'S256')
    return {
      authorizationUrl: `https://api.instagram.com/oauth/authorize?${params}`,
      state: input.state,
      codeVerifier,
    }
  }

  async exchangeCode(input: AuthCallbackInput): Promise<ProviderCredential> {
    if (!input.codeVerifier) {
      throw new Error('Instagram exchangeCode requires codeVerifier (PKCE is mandatory)')
    }
    // Step 1: Exchange authorization code for short-lived token (via api.instagram.com)
    const tokenRes = await fetch(`${IG_AUTH_API}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: IG_CLIENT_ID,
        client_secret: IG_CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: input.redirectUri,
        code: input.code,
        code_verifier: input.codeVerifier,
      }),
    })
    const tokenData = await tokenRes.json()

    // Instagram short-lived token endpoint can return errors in two shapes:
    //   {"error_type":"OAuthException","code":400,"error_message":"..."}
    //   {"error":{"message":"...","type":"OAuthException","code":190}}
    if (tokenData.error || tokenData.error_type) {
      const msg =
        (typeof tokenData.error === 'object' ? tokenData.error?.message : tokenData.error) ??
        tokenData.error_message ??
        'unknown'
      console.error('[instagram-oauth] short-lived token exchange failed:', JSON.stringify(tokenData))
      throw new Error(`Instagram token exchange failed: ${msg}`)
    }

    // Step 2: Exchange short-lived for long-lived token (60 days) via ig_exchange_token.
    // This endpoint is NOT versioned — it lives at graph.instagram.com/access_token,
    // not graph.instagram.com/v25.0/access_token (which returns "Unsupported request").
    const longLivedRes = await fetch(
      `${INSTAGRAM_GRAPH_API_ORIGIN}/access_token?${new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_secret: IG_CLIENT_SECRET,
        access_token: tokenData.access_token,
      })}`
    )
    const longLived = await longLivedRes.json()

    if (longLived.error || longLived.error_type) {
      const msg =
        (typeof longLived.error === 'object' ? longLived.error?.message : longLived.error) ??
        longLived.error_message ??
        'unknown'
      console.error('[instagram-oauth] long-lived token exchange failed:', JSON.stringify(longLived))
      throw new Error(`Instagram long-lived token exchange failed: ${msg}`)
    }

    // Get the IG user ID + account info
    const meRes = await fetch(
      `${IG_GRAPH_API}/me?fields=id,username&access_token=${longLived.access_token}`
    )
    const me = await meRes.json()

    // Get granted scopes
    const scopesRes = await fetch(
      `${IG_GRAPH_API}/me/permissions?access_token=${longLived.access_token}`
    )
    const scopesData = await scopesRes.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grantedScopes = (scopesData.data || []).map((s: any) => s.permission)

    return {
      accessTokenEncrypted: encrypt(longLived.access_token),
      tokenType: 'bearer',
      expiresAt: longLived.expires_in
        ? new Date(Date.now() + longLived.expires_in * 1000)
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // fallback 60 days
      scopes: grantedScopes,
      accountId: me.id,
      accountName: me.username,
      encryptionKeyId: getActiveKeyId(),
    }
  }

  async validateCredential(credential: {
    accessTokenEncrypted: string
    targetId?: string
  }): Promise<CredentialHealth> {
    const { decrypt } = await import('../crypto')
    const token = decrypt(credential.accessTokenEncrypted)

    try {
      // Verify token is still valid by calling /me
      const meRes = await fetch(`${IG_GRAPH_API}/me?fields=id,username&access_token=${token}`)
      if (meRes.status === 401) {
        return {
          status: 'expired',
          canPublish: false,
          message: 'توکن اینستاگرام منقضی شده است. لطفاً حساب را مجدداً متصل کنید.',
          missingScopes: [],
          validatedAt: new Date(),
        }
      }
      if (!meRes.ok) {
        return {
          status: 'error',
          canPublish: false,
          message: 'خطا در بررسی وضعیت اینستاگرام',
          missingScopes: [],
          validatedAt: new Date(),
        }
      }

      // Check granted scopes
      const scopesRes = await fetch(
        `${IG_GRAPH_API}/me/permissions?access_token=${token}`
      )
      const scopesData = await scopesRes.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const grantedScopes = (scopesData.data || []).map((s: any) => s.permission)
      const required = REQUIRED_SCOPES.instagram
      const missingScopes = required.filter((s) => !grantedScopes.includes(s))

      if (missingScopes.length > 0) {
        return {
          status: 'invalid',
          canPublish: false,
          message: `دسترسی‌های ناقص: ${missingScopes.join('، ')}. لطفاً مجدداً متصل کنید.`,
          missingScopes,
          validatedAt: new Date(),
        }
      }

      return {
        status: 'active',
        canPublish: true,
        message: 'حساب اینستاگرام متصل و فعال است',
        missingScopes: [],
        validatedAt: new Date(),
      }
    } catch {
      return {
        status: 'error',
        canPublish: false,
        message: 'خطای شبکه در بررسی وضعیت اینستاگرام',
        missingScopes: [],
        validatedAt: new Date(),
      }
    }
  }
}

// ── LinkedIn ──────────────────────────────────────────────────

const LI_API = 'https://api.linkedin.com'
const LI_AUTH = 'https://www.linkedin.com/oauth/v2'

const LI_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || ''
const LI_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || ''

export class LinkedInAuthAdapter implements ProviderAuthAdapter {
  readonly provider = 'linkedin' as const

  async getAuthorizationUrl(input: AuthStartInput): Promise<AuthStartResult> {
    const scopes = REQUIRED_SCOPES.linkedin.join(' ')
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: LI_CLIENT_ID,
      redirect_uri: input.redirectUri,
      state: input.state,
      scope: scopes,
    })
    return {
      authorizationUrl: `${LI_AUTH}/authorization?${params}`,
      state: input.state,
    }
  }

  async exchangeCode(input: AuthCallbackInput): Promise<ProviderCredential> {
    const tokenRes = await fetch(`${LI_AUTH}/accessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: input.code,
        client_id: LI_CLIENT_ID,
        client_secret: LI_CLIENT_SECRET,
        redirect_uri: input.redirectUri,
      }),
    })
    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      throw new Error(`LinkedIn token exchange failed: ${tokenData.error_description || tokenData.error}`)
    }

    // Get user profile (member ID)
    const meRes = await fetch(`${LI_API}/v2/userinfo`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    })
    const me = await meRes.json()

    // LinkedIn access tokens expire in 60 days
    return {
      accessTokenEncrypted: encrypt(tokenData.access_token),
      refreshTokenEncrypted: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : undefined,
      tokenType: 'bearer',
      expiresAt: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      scopes: (tokenData.scope || '').split(' ').filter(Boolean),
      accountId: me.sub || '',
      accountName: me.name || me.email || 'LinkedIn User',
      encryptionKeyId: getActiveKeyId(),
    }
  }

  async validateCredential(credential: {
    accessTokenEncrypted: string
    targetId?: string
  }): Promise<CredentialHealth> {
    const { decrypt } = await import('../crypto')
    const token = decrypt(credential.accessTokenEncrypted)

    try {
      // Verify token is still valid
      const meRes = await fetch(`${LI_API}/v2/userinfo`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      })
      if (meRes.status === 401) {
        return {
          status: 'expired',
          canPublish: false,
          message: 'توکن لینکدین منقضی شده است. لطفاً حساب را مجدداً متصل کنید.',
          missingScopes: [],
          validatedAt: new Date(),
        }
      }
      if (!meRes.ok) {
        return {
          status: 'error',
          canPublish: false,
          message: 'خطا در بررسی وضعیت لینکدین',
          missingScopes: [],
          validatedAt: new Date(),
        }
      }

      return {
        status: 'active',
        canPublish: true,
        message: 'حساب لینکدین متصل و فعال است',
        missingScopes: [],
        validatedAt: new Date(),
      }
    } catch {
      return {
        status: 'error',
        canPublish: false,
        message: 'خطای شبکه در بررسی وضعیت لینکدین',
        missingScopes: [],
        validatedAt: new Date(),
      }
    }
  }
}

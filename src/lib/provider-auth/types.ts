/**
 * Issue #144: Provider authentication adapter contract.
 *
 * Every provider (Instagram, LinkedIn, Telegram, Bale, Rubika, Eitaa) must
 * implement this interface. The connect route uses these adapters to validate
 * credentials, store real expiry/scopes, and support refresh/revoke lifecycle.
 *
 * Two adapter types:
 *   - OAuth providers (Instagram, LinkedIn): getAuthorizationUrl → exchangeCode → validateCredential
 *   - Bot-token providers (Telegram, Bale, Rubika): validateCredential only
 *
 * Both types return the same normalized ProviderCredential + CredentialHealth.
 */

import type { PlatformKey } from '../provider-capabilities'

// ── Types ──────────────────────────────────────────────────────

export interface ProviderCredential {
  /** Encrypted access token (AES-256-GCM via crypto.ts) */
  accessTokenEncrypted: string
  /** Encrypted refresh token (OAuth providers only, null for bot tokens) */
  refreshTokenEncrypted?: string
  /** Token type: 'bearer' | 'bot' */
  tokenType: 'bearer' | 'bot'
  /** Provider-reported expiry (null = no expiry, e.g. bot tokens) */
  expiresAt: Date | null
  /** Granted OAuth scopes (comma-separated, empty for bot tokens) */
  scopes: string[]
  /** Provider account ID (ig-user-id, LinkedIn URN, Telegram bot ID) */
  accountId: string
  /** Provider account username/display name */
  accountName: string
  /** Encryption key ID used (for key rotation support) */
  encryptionKeyId: string
}

export type CredentialStatus =
  | 'pending'
  | 'active'
  | 'expiring'
  | 'expired'
  | 'revoked'
  | 'invalid'
  | 'error'

export interface CredentialHealth {
  status: CredentialStatus
  /** True if the credential can be used for publishing right now */
  canPublish: boolean
  /** Safe Persian message for the user (no secrets) */
  message: string
  /** Missing required scopes (empty if all present) */
  missingScopes: string[]
  /** Last validation timestamp */
  validatedAt: Date
}

export interface AuthStartInput {
  workspaceId: string
  platformId: string
  redirectUri: string
  /** PKCE code verifier (OAuth providers) */
  codeVerifier?: string
  /** CSRF state token */
  state: string
}

export interface AuthStartResult {
  authorizationUrl: string
  /** The state token to verify in the callback */
  state: string
  /** PKCE code verifier — present when the adapter auto-generated one */
  codeVerifier?: string
}

export interface AuthCallbackInput {
  code: string
  state: string
  redirectUri: string
  /** PKCE code verifier from the original request */
  codeVerifier?: string
}

export interface BotTokenInput {
  token: string
  /** Target channel/group/chat ID */
  targetId?: string
}

export interface PublishTarget {
  id: string
  name: string
  type: string
}

// ── Adapter Interface ──────────────────────────────────────────

export interface ProviderAuthAdapter {
  readonly provider: PlatformKey

  /**
   * OAuth providers: generate the authorization URL for the user to visit.
   * Bot-token providers: not used (throw if called).
   */
  getAuthorizationUrl?(input: AuthStartInput): Promise<AuthStartResult>

  /**
   * OAuth providers: exchange the authorization code for access + refresh tokens.
   * Bot-token providers: not used (throw if called).
   */
  exchangeCode?(input: AuthCallbackInput): Promise<ProviderCredential>

  /**
   * Validate a credential by contacting the provider API.
   * Returns the real health status, expiry, and scopes.
   * Used by both OAuth and bot-token providers.
   */
  validateCredential(credential: {
    accessTokenEncrypted: string
    refreshTokenEncrypted?: string
    targetId?: string
  }): Promise<CredentialHealth>

  /**
   * OAuth providers: refresh an expiring token.
   * Bot-token providers: not used (tokens don't expire).
   */
  refreshCredential?(credential: {
    refreshTokenEncrypted: string
  }): Promise<ProviderCredential>

  /**
   * Revoke a credential at the provider (best-effort).
   */
  revokeCredential?(credential: {
    accessTokenEncrypted: string
  }): Promise<void>

  /**
   * List valid publishing targets for this credential (e.g. IG professional accounts,
   * LinkedIn organizations, Telegram channels where the bot is admin).
   */
  listPublishTargets?(credential: {
    accessTokenEncrypted: string
  }): Promise<PublishTarget[]>

}

// ── Registry ───────────────────────────────────────────────────

const adapterRegistry = new Map<PlatformKey, ProviderAuthAdapter>()

export function registerProviderAuthAdapter(adapter: ProviderAuthAdapter): void {
  adapterRegistry.set(adapter.provider, adapter)
}

export function getProviderAuthAdapter(provider: string): ProviderAuthAdapter | null {
  return adapterRegistry.get(provider as PlatformKey) ?? null
}

// ── Required scopes per provider (Issue #144: real scope validation) ─────

export const REQUIRED_SCOPES: Record<string, string[]> = {
  // Instagram API with Instagram Login (2024+ path, no Facebook Page required).
  // instagram_business_manage_insights covers account + media analytics.
  instagram: [
    'instagram_business_basic',
    'instagram_business_content_publish',
    'instagram_business_manage_comments',
    'instagram_business_manage_messages',
    'instagram_business_manage_insights',
  ],
  linkedin: ['w_member_social', 'r_organization_social', 'w_organization_social'],
  telegram: [],
  bale: [],
  rubika: [],
  eitaa: [],
}

// ── Helper: compute credential status from health + expiry ─────

export function computeCredentialStatus(
  health: CredentialHealth,
  expiresAt: Date | null,
  now: Date = new Date()
): CredentialStatus {
  if (health.status === 'revoked') return 'revoked'
  if (health.status === 'invalid') return 'invalid'
  if (expiresAt) {
    const msUntilExpiry = expiresAt.getTime() - now.getTime()
    if (msUntilExpiry <= 0) return 'expired'
    if (msUntilExpiry <= 7 * 24 * 60 * 60 * 1000) return 'expiring' // 7 days
  }
  return 'active'
}

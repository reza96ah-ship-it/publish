/**
 * Issue #255: Public API + signed webhooks — API Tokens domain types.
 *
 * API tokens are long-lived bearer credentials issued by workspace admins
 * for external integrations. The plaintext token is shown to the admin
 * EXACTLY ONCE on creation; only the SHA-256 hash + a 12-char prefix
 * (for UI display) are persisted. See src/lib/api-token.ts for the crypto.
 */

export interface AuthContext {
  workspaceId: string
  userId: string
}

// ── Item shapes ──────────────────────────────────────────────────────────────

export interface ApiTokenItem {
  id: string
  name: string
  prefix: string // `nsh_aB3xY9zK` — first 12 chars of plaintext for UI display
  scopes: string[]
  lastUsedAt: Date | null
  expiresAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

// ── Create / result ──────────────────────────────────────────────────────────

export interface CreateApiTokenInput {
  name: string
  scopes: string[]
  /**
   * Optional ISO-8601 datetime string (or null for "no expiry"). The route
   * layer passes this straight from the Zod schema (apiTokenCreateSchema);
   * the service converts it to a Date before persisting.
   */
  expiresAt?: string | null
}

/**
 * Result of createToken — the plaintext is shown to the admin ONCE and is
 * unrecoverable afterwards. The `token` field is the persisted row (with
 * the prefix but NOT the plaintext); `plaintext` is the full bearer string
 * the admin must copy immediately.
 */
export interface CreateApiTokenResult {
  token: ApiTokenItem
  plaintext: string
}

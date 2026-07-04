/**
 * Issue #200: OAuth domain module — types.
 *
 * Pure domain types shared between OAuth route handlers and the service.
 * No Prisma or Next.js imports.
 */

export interface StartOAuthInput {
  workspaceId: string
  userId: string
  /** Provider type ('instagram' | 'linkedin' | ...) */
  type: string
  /** App base URL — used to build the redirect URI sent to the provider */
  baseUrl: string
}

export interface StartOAuthSuccess {
  ok: true
  /** Provider authorization URL — the route handler redirects the browser here */
  authorizationUrl: string
  /** Name of the state cookie to set on the response */
  cookieName: string
  /** JSON payload to store in the state cookie */
  cookiePayload: string
  /** Cookie max-age in seconds (15 min) */
  cookieMaxAge: number
}

export interface StartOAuthError {
  ok: false
  /** Browser-side error redirect URL (/channels?oauth_error=...) */
  redirectUrl: string
}

export type StartOAuthResult = StartOAuthSuccess | StartOAuthError

export interface CallbackInput {
  workspaceId: string
  userId: string
  /** Authorization code from ?code= */
  code: string | null
  /** State token from ?state= */
  state: string | null
  /** Provider error (?error=...) — set when the user denies consent */
  providerError: string | null
  providerErrorDescription: string | null
  /** Value of the oauth_state_${state} cookie (if present) */
  cookieValue: string | undefined
  /** App base URL */
  baseUrl: string
}

export interface CallbackResult {
  /** Final redirect URL — /channels?oauth_success=1 or /channels?oauth_error=... */
  redirectUrl: string
  /** Cookie to clear on the response (always set, even on success) */
  clearCookieName: string
}

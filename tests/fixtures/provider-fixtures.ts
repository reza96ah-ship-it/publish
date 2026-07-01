/**
 * Issue #153 Tier 4: Provider contract test fixtures.
 *
 * Synthetic fixtures for every documented provider result class.
 * Each fixture simulates a provider API response so we can test
 * adapter behavior without hitting real provider APIs.
 *
 * Result classes covered:
 *   - success (201/200 with post ID)
 *   - auth failure (401/403)
 *   - permission failure (403 with specific error)
 *   - validation failure (400 with field errors)
 *   - rate limit (429 with retry_after)
 *   - transient server error (500/502/503)
 *   - permanent client error (404/410)
 *   - timeout (no response)
 *   - malformed response (200 with invalid JSON)
 *   - unknown outcome (connection reset after request sent)
 */

export interface ProviderFixture {
  name: string
  status: number
  body: unknown
  headers?: Record<string, string>
  /** Simulates a timeout (no response) */
  timeout?: boolean
  /** Simulates a connection reset */
  connectionReset?: boolean
  /** Expected adapter behavior */
  expectedStatus: 'success' | 'failed' | 'action'
  expectedErrorCategory?: string
  expectedRetryable?: boolean
  expectedOutcomeUnknown?: boolean
}

// ── Telegram fixtures ──────────────────────────────────────────

export const TELEGRAM_FIXTURES: ProviderFixture[] = [
  {
    name: 'success-sendMessage',
    status: 200,
    body: { ok: true, result: { message_id: 12345, chat: { id: -100123, title: 'Test' } } },
    expectedStatus: 'success',
  },
  {
    name: 'success-sendPhoto',
    status: 200,
    body: { ok: true, result: { message_id: 12346, chat: { id: -100123 } } },
    expectedStatus: 'success',
  },
  {
    name: 'auth-invalid-token',
    status: 200,
    body: { ok: false, error_code: 401, description: 'Unauthorized' },
    expectedStatus: 'action',
    expectedErrorCategory: 'auth',
  },
  {
    name: 'rate-limit',
    status: 200,
    body: { ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 30 } },
    expectedStatus: 'failed',
    expectedErrorCategory: 'rate_limit',
    expectedRetryable: true,
  },
  {
    name: 'chat-not-found',
    status: 200,
    body: { ok: false, error_code: 400, description: 'Chat not found' },
    expectedStatus: 'action',
    expectedErrorCategory: 'unknown',
  },
  {
    name: 'timeout',
    status: 0,
    body: null,
    timeout: true,
    expectedStatus: 'failed',
    expectedOutcomeUnknown: true,
  },
  {
    name: 'malformed-response',
    status: 200,
    body: 'not-json',
    expectedStatus: 'action',
    expectedErrorCategory: 'unknown',
  },
]

// ── LinkedIn fixtures ──────────────────────────────────────────

export const LINKEDIN_FIXTURES: ProviderFixture[] = [
  {
    name: 'success-text-post',
    status: 201,
    body: null, // 201 has empty body — post ID is in x-restli-id header
    headers: { 'x-restli-id': 'urn:li:share:1234567890' },
    expectedStatus: 'success',
  },
  {
    name: 'auth-expired-token',
    status: 401,
    body: { status: 401, code: 'UNAUTHORIZED', message: 'Token expired' },
    expectedStatus: 'action',
    expectedErrorCategory: 'auth',
  },
  {
    name: 'permission-denied',
    status: 403,
    body: { status: 403, code: 'FORBIDDEN', message: 'Insufficient permissions' },
    expectedStatus: 'action',
    expectedErrorCategory: 'auth',
  },
  {
    name: 'rate-limit',
    status: 429,
    body: { status: 429, message: 'Rate limit exceeded' },
    expectedStatus: 'failed',
    expectedErrorCategory: 'rate_limit',
    expectedRetryable: true,
  },
  {
    name: 'server-error',
    status: 500,
    body: { status: 500, message: 'Internal server error' },
    expectedStatus: 'failed',
    expectedErrorCategory: 'network',
    expectedRetryable: true,
  },
  {
    name: 'not-found',
    status: 404,
    body: { status: 404, message: 'Resource not found' },
    expectedStatus: 'action',
    expectedErrorCategory: 'not_found',
  },
  {
    name: 'timeout',
    status: 0,
    body: null,
    timeout: true,
    expectedStatus: 'failed',
    expectedOutcomeUnknown: true,
  },
]

// ── Instagram fixtures ─────────────────────────────────────────

export const INSTAGRAM_FIXTURES: ProviderFixture[] = [
  {
    name: 'success-publish',
    status: 200,
    body: { id: '1789564321' },
    expectedStatus: 'success',
  },
  {
    name: 'auth-token-expired',
    status: 200,
    body: { error: { code: 190, message: 'Token expired', type: 'OAuthException' } },
    expectedStatus: 'action',
    expectedErrorCategory: 'auth',
  },
  {
    name: 'permission-denied',
    status: 200,
    body: { error: { code: 200, message: 'Insufficient permissions', type: 'OAuthException' } },
    expectedStatus: 'action',
    expectedErrorCategory: 'auth',
  },
  {
    name: 'rate-limit',
    status: 200,
    body: { error: { code: 4, message: 'Application request limit reached', type: 'OAuthException' } },
    expectedStatus: 'failed',
    expectedErrorCategory: 'rate_limit',
    expectedRetryable: true,
  },
  {
    name: 'validation-invalid-media',
    status: 200,
    body: { error: { code: 100, message: 'Invalid image URL', type: 'OAuthException' } },
    expectedStatus: 'action',
    expectedErrorCategory: 'not_found',
  },
  {
    name: 'server-error',
    status: 500,
    body: { error: { code: 500, message: 'Internal error' } },
    expectedStatus: 'failed',
    expectedErrorCategory: 'network',
    expectedRetryable: true,
  },
  {
    name: 'timeout',
    status: 0,
    body: null,
    timeout: true,
    expectedStatus: 'failed',
    expectedOutcomeUnknown: true,
  },
]

// ── All fixtures combined ──────────────────────────────────────

export const ALL_FIXTURES: Record<string, ProviderFixture[]> = {
  telegram: TELEGRAM_FIXTURES,
  linkedin: LINKEDIN_FIXTURES,
  instagram: INSTAGRAM_FIXTURES,
}

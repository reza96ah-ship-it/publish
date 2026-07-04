/**
 * Issue #156: Shared API contracts — normalized error envelope + pagination.
 *
 * One source of truth for:
 *   - Normalized error response shape
 *   - Pagination envelope + cursor policy
 *   - Domain enums (mirrored from Prisma, not manual strings)
 */

// ── Normalized Error Envelope ─────────────────────────────────

export interface ApiError {
  /** Stable machine-readable error code (never changes, safe to switch on) */
  code: string
  /** Safe Persian user message (no secrets, no stack traces) */
  message: string
  /** Request ID for traceability */
  requestId?: string
  /** Optional field-level validation errors */
  fieldErrors?: Record<string, string>
  /** HTTP status code */
  statusCode: number
}

export function apiError(
  code: string,
  message: string,
  statusCode: number,
  opts?: { requestId?: string; fieldErrors?: Record<string, string> }
): ApiError {
  return {
    code,
    message,
    statusCode,
    requestId: opts?.requestId,
    fieldErrors: opts?.fieldErrors,
  }
}

// Common error codes (stable, machine-readable)
export const ERROR_CODES = {
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  VALIDATION_ERROR: 'validation_error',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',
  INTERNAL_ERROR: 'internal_error',
  NO_WORKSPACE: 'no_workspace',
  NO_CHANNELS: 'no_channels',
  CHANNELS_NOT_FOUND: 'channels_not_found',
  PUBLICATION_NOT_FOUND: 'publication_not_found',
  OUTBOX_NOT_FOUND: 'outbox_not_found',
  INVALID_TOKEN: 'invalid_token',
  TOKEN_EXPIRED: 'token_expired',
  INSUFFICIENT_PERMISSIONS: 'insufficient_permissions',
  LAST_ADMIN: 'last_admin',
  INVITATION_EXPIRED: 'invitation_expired',
  INVITATION_REVOKED: 'invitation_revoked',
  INVITATION_ALREADY_ACCEPTED: 'invitation_already_accepted',
} as const

// ── Pagination Envelope ───────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
}

export function paginated<T>(
  data: T[],
  limit: number,
  cursorExtractor: (item: T) => string
): PaginatedResponse<T> {
  const hasMore = data.length > limit
  const trimmed = hasMore ? data.slice(0, limit) : data
  const lastItem = trimmed[trimmed.length - 1]
  const nextCursor = hasMore && lastItem !== undefined
    ? cursorExtractor(lastItem)
    : null

  return {
    data: trimmed,
    nextCursor,
    hasMore,
  }
}

// ── Domain Enums (mirrored from Prisma, not manual strings) ────

export type ContentStatus =
  | 'draft'
  | 'review'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'partially_published'
  | 'failed'
  | 'action_required'
  | 'cancelled'

export type PublicationStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'action'
  | 'scheduled'
  | 'cancelled'
  | 'outcome_unknown'

export type AttemptOutcome =
  | 'started'
  | 'provider_success'
  | 'local_success'
  | 'retryable_failure'
  | 'permanent_failure'
  | 'outcome_unknown'

export type ReconciliationStatus =
  | 'confirmed_success'
  | 'confirmed_failure'
  | 'still_unknown'

export type OutboxStatus =
  | 'pending'
  | 'claimed'
  | 'delivered'
  | 'retry_wait'
  | 'dead_letter'
  | 'cancelled'

export type CredentialStatus =
  | 'pending'
  | 'active'
  | 'expiring'
  | 'expired'
  | 'revoked'
  | 'invalid'
  | 'error'

export type ProviderSupportLevel = 'certified' | 'beta' | 'experimental'

export type Role = 'admin' | 'editor' | 'approver' | 'viewer'

/**
 * Exhaustive switch helper — ensures all enum cases are handled.
 * Throws at compile time if a new case is added but not handled.
 */
export function assertExhaustive(value: never): never {
  throw new Error(`Unhandled enum value: ${value}`)
}

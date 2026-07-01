/**
 * Channel Adapter Contract — TypeScript implementation of the architecture spec.
 * Every adapter (Instagram, Rubika, Telegram, LinkedIn, Eitaa) implements this.
 */

export type PlatformType = 'instagram' | 'rubika' | 'telegram' | 'linkedin' | 'eitaa' | 'bale'

export type JobStatus = 'pending' | 'processing' | 'success' | 'failed' | 'action' | 'scheduled'

export interface AdapterAccount {
  id: string
  type: PlatformType
  username: string
  status: string
  circuitState: 'closed' | 'open' | 'half_open'
  /** Bot token (Telegram/Bale/Rubika) or OAuth access token (Instagram/LinkedIn) */
  token?: string
  /** Platform-specific: chat_id for Telegram/Bale, ig-user-id for Instagram, author-urn for LinkedIn */
  targetId?: string
}

export interface AdapterMediaItem {
  type: 'photo' | 'video' | 'document'
  url: string
  altText?: string
}

export interface AdapterContent {
  id: string
  title: string
  body: string | null
  hashtags: string | null
  thumbnailUrl: string | null
  /** Media items to attach (if any) */
  mediaItems?: AdapterMediaItem[]
}

export interface AdapterJob {
  id: string
  retryCount: number
  content: AdapterContent
  account: AdapterAccount
  platformCaption?: string // per-platform override
  /**
   * Issue #149: stable, per-Publication operation ID — generated once at
   * Publication-creation time (src/modules/publications/repository.ts),
   * persisted to `Publication.publicationOperationId`, and read (never
   * recomputed) on every subsequent attempt. Same value across ALL retries
   * for the same logical publication.
   *
   * IMPORTANT — verified against each provider's current official docs
   * (2026-07): NONE of the 6 supported providers (LinkedIn, Instagram,
   * Telegram, Bale, Rubika, Eitaa) accept a client-supplied idempotency key
   * on their post-creation endpoint today:
   *   - LinkedIn Posts API: only post *deletion* is documented as
   *     idempotent; POST /rest/posts has no Idempotency-Key header or
   *     dedupe field. `X-Restli-Method` exists but only disambiguates
   *     PARTIAL_UPDATE/BATCH_* semantics, not idempotency.
   *   - Instagram Graph API: /media and /media_publish accept no
   *     client request key (confirmed unsupported in this codebase's own
   *     adapter comments before this fix).
   *   - Telegram/Bale (Telegram-Bot-API-compatible) and Rubika/Eitaa bot
   *     APIs: sendMessage/sendPhoto/sendVideo/sendDocument/sendMediaGroup
   *     accept no dedupe token of any kind.
   * This field is still threaded through to every adapter (and forwarded
   * into `rawResponse`/logs where applicable) so it is available: (a) to a
   * future provider or API version that adds real idempotency-key support,
   * and (b) as the stable correlation ID recorded in the attempt ledger and
   * used by `reconcile()`. Duplicate prevention for these 6 providers is
   * enforced entirely on OUR side — via the stable requestFingerprint +
   * PublicationAttempt ledger checks in the worker (findSuccessByFingerprint /
   * findUnresolvedUnknown) — not via a provider-side idempotency key.
   */
  publicationOperationId?: string
  /**
   * Issue #149 (gap #2): same value as `publicationOperationId`, exposed
   * under the generic name adapters/HTTP clients conventionally look for.
   * Adapters that gain real provider-side idempotency support in the future
   * should read this field to populate the appropriate header/body field.
   */
  idempotencyKey: string
}

export interface HealthResult {
  healthy: boolean
  status: 'active' | 'expired' | 'error' | 'disconnected'
  lastError: string | null
}

export interface ReadinessIssue {
  code: string // caption_too_long | media_missing | token_expired | ...
  message: string // Persian, actionable
  platform: string
}

export interface ReadinessResult {
  ready: boolean
  issues: ReadinessIssue[]
}

export type PublishOutcome = 'success' | 'failed' | 'action'

// BUG-05: typed error category replaces Persian string-matching in the worker
export type ErrorCategory = 'auth' | 'rate_limit' | 'not_found' | 'network' | 'unknown'

export interface PublishResult {
  externalId: string | null
  rawResponse: Record<string, unknown>
  status: PublishOutcome
  error: string | null
  /** whether the error is transient (5xx, 429, network) and should be retried */
  retryable: boolean
  /** structured error category — worker uses this instead of Persian string matching */
  errorCategory?: ErrorCategory
  /**
   * Issue #147 A: provider-supplied retry delay (e.g. Telegram's retry_after,
   * in seconds, converted to ms here). When present, the worker's backoff
   * computation honors it instead of the default exponential schedule.
   */
  retryAfterMs?: number
  /**
   * Issue #147 D: set when the outcome is genuinely ambiguous — e.g. a
   * request timeout where we don't know if the provider received/processed
   * it. The normalizer maps this to RetryDirective's `outcome_unknown` kind
   * instead of blindly retrying (which could create a duplicate post).
   */
  outcomeUnknown?: boolean
  /** simulated step labels for UI progression (mock mode) */
  steps?: { label: string; at: number }[]
}

export interface ChannelAdapter {
  readonly platform: PlatformType

  healthCheck(account: AdapterAccount): Promise<HealthResult>
  validateReadiness(content: AdapterContent, account: AdapterAccount): Promise<ReadinessResult>
  publish(job: AdapterJob): Promise<PublishResult>
  /**
   * Issue #149: Optional reconciliation for unknown-outcome publications.
   * Called when the worker can't determine if a provider accepted the post.
   * Returns confirmed_success, confirmed_failure, or still_unknown.
   */
  reconcile?(input: ReconcileInput): Promise<ReconcileOutcome>
}

/**
 * Issue #149: Reconciliation input — passed to the adapter when
 * checking if a provider received/accepted a post after an ambiguous outcome.
 */
export interface ReconcileInput {
  /** The publication's stable operation ID (sent to the provider if supported) */
  publicationOperationId?: string
  /** The provider post ID if one was returned before the ambiguous outcome */
  providerPostId?: string
  /** The account credential (decrypted) */
  account: AdapterAccount
  /** The content that was being published */
  content: AdapterContent
}

/**
 * Issue #149: Reconciliation outcome — one of three possible results.
 */
export type ReconcileOutcome =
  | { kind: 'confirmed_success'; providerPostId: string }
  | { kind: 'confirmed_failure'; reason: string }
  | { kind: 'still_unknown'; nextCheckAt?: Date }

/**
 * Base error class for adapter failures.
 * `retryable` drives the worker's retry/backoff decision.
 */
export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly statusCode?: number,
    public readonly externalId?: string
  ) {
    super(message)
    this.name = 'AdapterError'
  }
}

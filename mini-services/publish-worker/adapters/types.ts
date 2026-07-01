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
  idempotencyKey: string
  retryCount: number
  content: AdapterContent
  account: AdapterAccount
  platformCaption?: string // per-platform override
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
}

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

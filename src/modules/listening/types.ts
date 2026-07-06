/**
 * Issue #251: Social listening foundation + spike alerts — types.
 *
 * A ListeningQuery is a saved search across one or more providers
 * (Instagram, Telegram, …). Each query tracks:
 *   - keywords (brand names, hashtags, competitor names)
 *   - providers to monitor
 *   - spike-alert config (rolling-window mean + stddev threshold)
 *   - coverage disclosure notes (honest transparency about what is
 *     NOT accessible via the provider's API — e.g. Instagram DMs)
 *
 * A ListeningMention is a single captured post/comment matching a query.
 * Coverage rules (#251):
 *   - `coverageSource` always populated (e.g. "Instagram Graph API — comments only")
 *   - `autoSentiment` is NEVER exposed to users — only `verifiedSentiment`
 *     (human-reviewed) is shown. When `verifiedSentiment` is null the UI
 *     shows "احساس بررسی نشده" (sentiment not reviewed).
 *   - `isSpike` is set by `service.detectSpike()` using a rolling-window
 *     mean + stddev threshold.
 *
 * Saved searches are shareable via a `shareToken`. The public endpoint
 * `/api/listening/shared/[token]` returns the query + recent mentions with
 * NO auth — intended for stakeholder review links.
 */

export interface AuthContext {
  workspaceId: string
  userId: string
}

// ── Listening query item ─────────────────────────────────────────────────────

export interface ListeningQueryItem {
  id: string
  workspaceId: string
  name: string
  keywords: string[]
  languages: string[]
  providers: string[]
  spikeAlertEnabled: boolean
  spikeThreshold: number
  spikeWindowHours: number
  coverageNotes: string | null
  shareToken: string | null
  isActive: boolean
  lastCheckedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// ── Listening mention item ───────────────────────────────────────────────────
//
// NOTE: `autoSentiment` is INTENTIONALLY omitted from this type — it is never
// exposed beyond the repository / spike-detection internals. Only
// `verifiedSentiment` is part of the public type surface so the API can never
// accidentally leak auto-classified sentiment to the client (#251 requirement).

export interface ListeningMentionItem {
  id: string
  queryId: string
  workspaceId: string
  provider: string
  content: string
  authorName: string
  authorAvatar: string | null
  sourceUrl: string | null
  likes: number
  comments: number
  shares: number
  detectedLanguage: string | null
  spamScore: number
  verifiedSentiment: string | null // positive | neutral | negative | null
  isSpike: boolean
  spikeScore: number | null
  coverageSource: string | null
  mentionedAt: Date
  createdAt: Date
}

// ── Spike alert payload (returned by detectSpike) ───────────────────────────

export interface SpikeAlert {
  queryId: string
  /** Mean mentions per bucket in the rolling window. */
  mean: number
  /** Standard deviation of mentions per bucket in the rolling window. */
  stddev: number
  /** Spike threshold = mean + spikeThreshold * stddev. */
  threshold: number
  /** Number of mentions flagged as spike in this pass. */
  spikeCount: number
  /** Total mentions evaluated (those within the spike window). */
  evaluated: number
  /** ISO timestamp of the detection run. */
  detectedAt: Date
}

// ── Coverage disclosure ─────────────────────────────────────────────────────

export interface CoverageProvider {
  /** Provider key (instagram, telegram, …). */
  provider: string
  /** Persian label for the provider. */
  label: string
  /** Human-readable source (e.g. "Instagram Graph API — کامنت‌ها"). */
  source: string
  /** True if we actively capture mentions from this provider. */
  covered: boolean
}

export interface CoverageDisclosure {
  queryId: string
  providers: CoverageProvider[]
  /** Coverage notes authored by the workspace admin (free text). */
  notes: string | null
  /** Persian summary line, e.g. "فقط کامنت‌های اینستاگرام — دایرکت‌ها قابل دسترسی نیستند". */
  summary: string
}

// ── List query / result ──────────────────────────────────────────────────────

export interface ListeningListQuery {
  cursor?: string
  limit?: number
  isActive?: boolean
}

export interface ListeningListResult {
  data: ListeningQueryItem[]
  nextCursor: string | null
}

export interface MentionListQuery {
  cursor?: string
  limit?: number
  /** Filter: only spike-flagged mentions. */
  spike?: boolean
  /** Filter: only mentions with a specific verified sentiment. */
  sentiment?: 'positive' | 'neutral' | 'negative'
  /** Filter: only mentions in a specific detected language. */
  language?: string
}

export interface MentionListResult {
  data: ListeningMentionItem[]
  nextCursor: string | null
}

// ── Create / Update inputs ───────────────────────────────────────────────────

export interface CreateListeningQueryInput {
  name: string
  keywords: string[]
  languages?: string[]
  providers: string[]
  spikeAlertEnabled?: boolean
  spikeThreshold?: number
  spikeWindowHours?: number
  coverageNotes?: string
}

export type UpdateListeningQueryInput = Partial<CreateListeningQueryInput> & {
  isActive?: boolean
}

// ── Mention creation (internal: ingestion pipeline, not exposed via API) ────

export interface CreateListeningMentionInput {
  queryId: string
  workspaceId: string
  provider: string
  content: string
  authorName: string
  authorAvatar?: string | null
  sourceUrl?: string | null
  likes?: number
  comments?: number
  shares?: number
  detectedLanguage?: string | null
  spamScore?: number
  autoSentiment?: string | null
  verifiedSentiment?: string | null
  coverageSource?: string | null
  mentionedAt: Date
}

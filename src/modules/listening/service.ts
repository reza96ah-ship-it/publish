/**
 * Issue #251: Social listening foundation + spike alerts — service.
 *
 * Business-logic layer. Follows the smart-pages/service.ts pattern:
 *   - Constructor injects the repository (default = new instance).
 *   - Cursor pagination handled in the service: repo returns `limit+1` rows,
 *     service slices + derives `nextCursor`.
 *   - Throws domain errors (ListeningError subclasses) — route handler maps
 *     them to HTTP via `instanceof ListeningError`.
 *
 * Coverage rules (#251):
 *   - createQuery generates a shareToken (cuid-like random hex).
 *   - getQueryByShareToken is PUBLIC (no auth) — used by the shared-search
 *     endpoint for stakeholder review links.
 *   - detectSpike computes mean + stddev over per-hour buckets in the rolling
 *     window, then marks mentions whose bucket count exceeds
 *     `mean + spikeThreshold * stddev` as isSpike=true.
 *   - getCoverageDisclosure returns which providers are covered and what is
 *     NOT covered (honest transparency about API limitations).
 */

import { randomBytes } from 'crypto'
import { ListeningRepository } from './repository'
import { ListeningQueryNotFoundError, ListeningValidationError } from './errors'
import type {
  AuthContext,
  ListeningQueryItem,
  ListeningMentionItem,
  ListeningListQuery,
  ListeningListResult,
  MentionListQuery,
  MentionListResult,
  CreateListeningQueryInput,
  UpdateListeningQueryInput,
  SpikeAlert,
  CoverageDisclosure,
  CoverageProvider,
} from './types'

const DEFAULT_LIMIT = 20

/**
 * Known providers + their honest coverage labels (#251: transparency about
 * what each provider's API actually exposes). The `source` field is what
 * we surface to users on every mention.
 */
const PROVIDER_COVERAGE: Record<string, { label: string; source: string }> = {
  instagram: {
    label: 'اینستاگرام',
    source: 'Instagram Graph API — کامنت‌ها',
  },
  telegram: {
    label: 'تلگرام',
    source: 'Telegram Bot API — پیام‌های کانال‌های عمومی',
  },
}

/**
 * Default coverage summary used when the workspace admin hasn't authored
 * explicit `coverageNotes`. Phrased as an honest disclosure of limitations.
 */
const DEFAULT_COVERAGE_SUMMARY =
  'پوشش محدود است: فقط کامنت‌های اینستاگرام و پیام‌های کانال‌های عمومی تلگرام — دایرکت‌ها، استوری‌ها و پیام‌های خصوصی از طریق API قابل دسترسی نیستند.'

export class ListeningService {
  constructor(
    private readonly repo: ListeningRepository = new ListeningRepository()
  ) {}

  // ── Workspace-scoped (auth required) ───────────────────────────────────────

  /** List listening queries for the active workspace, cursor-paginated. */
  async listQueries(
    auth: AuthContext,
    query: ListeningListQuery
  ): Promise<ListeningListResult> {
    const limit = query.limit ?? DEFAULT_LIMIT
    const rows = await this.repo.listQueries(auth.workspaceId, {
      ...query,
      limit,
    })
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null
    return { data: page, nextCursor }
  }

  /** Get a single listening query. Verifies ownership. */
  async getQuery(auth: AuthContext, id: string): Promise<ListeningQueryItem> {
    const existing = await this.repo.findQueryByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new ListeningQueryNotFoundError()
    return existing
  }

  /**
   * Create a new listening query. Generates a 32-char hex shareToken.
   * Validates that at least one provider and one keyword are present.
   */
  async createQuery(
    auth: AuthContext,
    input: CreateListeningQueryInput
  ): Promise<ListeningQueryItem> {
    if (!input.providers || input.providers.length === 0) {
      throw new ListeningValidationError('حداقل یک پلتفرم باید انتخاب شود')
    }
    if (!input.keywords || input.keywords.length === 0) {
      throw new ListeningValidationError('حداقل یک کلمه کلیدی الزامی است')
    }
    const shareToken = generateShareToken()
    return this.repo.createQuery(auth.workspaceId, { ...input, shareToken })
  }

  /** Update a listening query. Verifies ownership first. */
  async updateQuery(
    auth: AuthContext,
    id: string,
    input: UpdateListeningQueryInput
  ): Promise<ListeningQueryItem> {
    const existing = await this.repo.findQueryByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new ListeningQueryNotFoundError()
    if (input.providers !== undefined && input.providers.length === 0) {
      throw new ListeningValidationError('حداقل یک پلتفرم باید انتخاب شود')
    }
    if (input.keywords !== undefined && input.keywords.length === 0) {
      throw new ListeningValidationError('حداقل یک کلمه کلیدی الزامی است')
    }
    return this.repo.updateQuery(id, input)
  }

  /** Delete a listening query. Verifies ownership first. */
  async deleteQuery(auth: AuthContext, id: string): Promise<void> {
    const existing = await this.repo.findQueryByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new ListeningQueryNotFoundError()
    await this.repo.deleteQuery(id)
  }

  /** List mentions for a query, cursor-paginated with filters. */
  async listMentions(
    auth: AuthContext,
    queryId: string,
    query: MentionListQuery
  ): Promise<MentionListResult> {
    const existing = await this.repo.findQueryByIdInWorkspace(queryId, auth.workspaceId)
    if (!existing) throw new ListeningQueryNotFoundError()
    const limit = query.limit ?? DEFAULT_LIMIT
    const rows = await this.repo.listMentions(queryId, { ...query, limit })
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null
    return { data: page, nextCursor }
  }

  /**
   * Detect spikes for a query: computes mean + stddev of per-hour mention
   * counts in the rolling `spikeWindowHours` window, then marks mentions
   * in buckets exceeding `mean + spikeThreshold * stddev` as isSpike=true.
   *
   * Returns a SpikeAlert summary. Idempotent: re-running clears prior flags
   * for buckets no longer above threshold.
   */
  async detectSpike(auth: AuthContext, queryId: string): Promise<SpikeAlert> {
    const existing = await this.repo.findQueryByIdInWorkspace(queryId, auth.workspaceId)
    if (!existing) throw new ListeningQueryNotFoundError()

    const hours = existing.spikeWindowHours
    const since = new Date()
    since.setHours(since.getHours() - hours)

    const buckets = await this.repo.countMentionsByBucket(queryId, since, hours)
    const counts = buckets.map((b) => b.count)
    const evaluated = counts.reduce((sum, c) => sum + c, 0)

    const mean = counts.length > 0 ? counts.reduce((s, c) => s + c, 0) / counts.length : 0
    const variance =
      counts.length > 1
        ? counts.reduce((s, c) => s + Math.pow(c - mean, 2), 0) / counts.length
        : 0
    const stddev = Math.sqrt(variance)
    const threshold = mean + existing.spikeThreshold * stddev

    // Flag buckets whose count exceeds the threshold (and threshold > 0 so we
    // don't flag everything when there's no signal at all).
    const flaggedBucketKeys = new Set<string>()
    for (const b of buckets) {
      if (threshold > 0 && b.count > threshold) {
        flaggedBucketKeys.add(b.bucket)
      }
    }

    const { spiked } = await this.repo.markSpikes(
      queryId,
      since,
      flaggedBucketKeys,
      mean,
      stddev
    )

    await this.repo.touchLastChecked(queryId).catch(() => {
      /* timestamp write failure is non-fatal */
    })

    return {
      queryId,
      mean,
      stddev,
      threshold,
      spikeCount: spiked,
      evaluated,
      detectedAt: new Date(),
    }
  }

  /**
   * Return coverage disclosure for a query: which providers are covered,
   * their human-readable source labels, and what is NOT covered.
   * Honest transparency (#251).
   */
  async getCoverageDisclosure(
    auth: AuthContext,
    queryId: string
  ): Promise<CoverageDisclosure> {
    const existing = await this.repo.findQueryByIdInWorkspace(queryId, auth.workspaceId)
    if (!existing) throw new ListeningQueryNotFoundError()
    return this.buildCoverageDisclosure(existing)
  }

  // ── Public (no auth) ───────────────────────────────────────────────────────
  //
  // Used by the shared-search endpoint. Returns the query + recent mentions.

  /** Public: fetch a listening query by share token (no auth). */
  async getQueryByShareToken(token: string): Promise<{
    query: ListeningQueryItem
    mentions: ListeningMentionItem[]
    coverage: CoverageDisclosure
  } | null> {
    const query = await this.repo.findQueryByShareToken(token)
    if (!query) return null

    const recent = await this.repo.listMentions(query.id, { limit: 50 })
    const coverage = this.buildCoverageDisclosure(query)
    return { query, mentions: recent, coverage }
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private buildCoverageDisclosure(query: ListeningQueryItem): CoverageDisclosure {
    const providers: CoverageProvider[] = query.providers.map((key) => {
      const known = PROVIDER_COVERAGE[key]
      return {
        provider: key,
        label: known?.label ?? key,
        source: known?.source ?? key,
        covered: true,
      }
    })

    // Surface NOT-covered providers (any known provider not in the query's list).
    for (const [key, meta] of Object.entries(PROVIDER_COVERAGE)) {
      if (!query.providers.includes(key)) {
        providers.push({
          provider: key,
          label: meta.label,
          source: meta.source,
          covered: false,
        })
      }
    }

    const summary = query.coverageNotes?.trim()
      ? query.coverageNotes
      : DEFAULT_COVERAGE_SUMMARY

    return {
      queryId: query.id,
      providers,
      notes: query.coverageNotes,
      summary,
    }
  }
}

/**
 * Generate a 32-char hex share token (128 bits of entropy). Stored in the
 * `shareToken` column on ListeningQuery. URL-safe, no hyphens so it can be
 * copy-pasted cleanly.
 */
function generateShareToken(): string {
  return randomBytes(16).toString('hex')
}

export const listeningService = new ListeningService()

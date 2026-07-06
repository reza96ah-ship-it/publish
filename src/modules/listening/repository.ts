/**
 * Issue #251: Social listening foundation + spike alerts — repository.
 *
 * Data-access layer. The ONLY file in this module that imports `db`.
 * Pattern follows smart-pages/repository.ts: transaction-free, cursor
 * pagination via `take limit+1`, row→item mappers coerce Prisma types.
 *
 * Coverage rules (#251):
 *   - `mentionToItem` STRIPS `autoSentiment` from the row before returning
 *     it to the service / API. The column is queryable for spike-detection
 *     internals but never crosses the module boundary.
 *   - `countMentionsByBucket` powers the rolling-window mean + stddev
 *     calculation in `service.detectSpike`.
 */

import { db } from '@/lib/db'
import type {
  ListeningQueryItem,
  ListeningMentionItem,
  ListeningListQuery,
  MentionListQuery,
  CreateListeningQueryInput,
  UpdateListeningQueryInput,
  CreateListeningMentionInput,
} from './types'

// ── Row → Item mappers ──────────────────────────────────────────────────────

function queryToItem(row: {
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
}): ListeningQueryItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    keywords: row.keywords,
    languages: row.languages,
    providers: row.providers,
    spikeAlertEnabled: row.spikeAlertEnabled,
    spikeThreshold: row.spikeThreshold,
    spikeWindowHours: row.spikeWindowHours,
    coverageNotes: row.coverageNotes,
    shareToken: row.shareToken,
    isActive: row.isActive,
    lastCheckedAt: row.lastCheckedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * Mention row mapper — STRIPS `autoSentiment` so it can never leak across
 * the module boundary (#251 requirement). The repository still writes
 * autoSentiment via createMention, and the spike-detection service can
 * read it via a private method, but the public ListeningMentionItem type
 * does not include it.
 */
function mentionToItem(row: {
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
  verifiedSentiment: string | null
  isSpike: boolean
  spikeScore: number | null
  coverageSource: string | null
  mentionedAt: Date
  createdAt: Date
}): ListeningMentionItem {
  return {
    id: row.id,
    queryId: row.queryId,
    workspaceId: row.workspaceId,
    provider: row.provider,
    content: row.content,
    authorName: row.authorName,
    authorAvatar: row.authorAvatar,
    sourceUrl: row.sourceUrl,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    detectedLanguage: row.detectedLanguage,
    spamScore: row.spamScore,
    verifiedSentiment: row.verifiedSentiment,
    isSpike: row.isSpike,
    spikeScore: row.spikeScore,
    coverageSource: row.coverageSource,
    mentionedAt: row.mentionedAt,
    createdAt: row.createdAt,
  }
}

export class ListeningRepository {
  // ── Listening queries ─────────────────────────────────────────────────────

  /**
   * List listening queries for a workspace, cursor-paginated by createdAt desc.
   * Returns `limit + 1` rows so the service can detect a next page.
   */
  async listQueries(
    workspaceId: string,
    query: ListeningListQuery
  ): Promise<ListeningQueryItem[]> {
    const limit = query.limit ?? 20
    const rows = await db.listeningQuery.findMany({
      where: {
        workspaceId,
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })
    return rows.map(queryToItem)
  }

  /** Find a single query within a workspace (ownership check). */
  async findQueryByIdInWorkspace(
    id: string,
    workspaceId: string
  ): Promise<ListeningQueryItem | null> {
    const row = await db.listeningQuery.findFirst({
      where: { id, workspaceId },
    })
    return row ? queryToItem(row) : null
  }

  /** Find a single query by share token (PUBLIC — no workspace filter). */
  async findQueryByShareToken(token: string): Promise<ListeningQueryItem | null> {
    const row = await db.listeningQuery.findFirst({
      where: { shareToken: token, isActive: true },
    })
    return row ? queryToItem(row) : null
  }

  /** Create a new listening query. */
  async createQuery(
    workspaceId: string,
    data: CreateListeningQueryInput & { shareToken: string }
  ): Promise<ListeningQueryItem> {
    const row = await db.listeningQuery.create({
      data: {
        workspaceId,
        name: data.name,
        keywords: data.keywords,
        languages: data.languages ?? [],
        providers: data.providers,
        spikeAlertEnabled: data.spikeAlertEnabled ?? true,
        spikeThreshold: data.spikeThreshold ?? 3.0,
        spikeWindowHours: data.spikeWindowHours ?? 24,
        coverageNotes: data.coverageNotes ?? null,
        shareToken: data.shareToken,
      },
    })
    return queryToItem(row)
  }

  /**
   * Update a listening query. Caller MUST have verified ownership first via
   * findQueryByIdInWorkspace — we trust the `id` here.
   */
  async updateQuery(
    id: string,
    data: UpdateListeningQueryInput
  ): Promise<ListeningQueryItem> {
    const row = await db.listeningQuery.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.keywords !== undefined ? { keywords: data.keywords } : {}),
        ...(data.languages !== undefined ? { languages: data.languages } : {}),
        ...(data.providers !== undefined ? { providers: data.providers } : {}),
        ...(data.spikeAlertEnabled !== undefined
          ? { spikeAlertEnabled: data.spikeAlertEnabled }
          : {}),
        ...(data.spikeThreshold !== undefined
          ? { spikeThreshold: data.spikeThreshold }
          : {}),
        ...(data.spikeWindowHours !== undefined
          ? { spikeWindowHours: data.spikeWindowHours }
          : {}),
        ...(data.coverageNotes !== undefined
          ? { coverageNotes: data.coverageNotes }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    })
    return queryToItem(row)
  }

  /** Delete a listening query. Cascades to mentions via Prisma relation. */
  async deleteQuery(id: string): Promise<void> {
    await db.listeningQuery.delete({ where: { id } })
  }

  /** Update the lastCheckedAt timestamp (used after a polling pass). */
  async touchLastChecked(id: string): Promise<void> {
    await db.listeningQuery.update({
      where: { id },
      data: { lastCheckedAt: new Date() },
    })
  }

  // ── Listening mentions ────────────────────────────────────────────────────

  /**
   * List mentions for a query, cursor-paginated by mentionedAt desc.
   * Returns `limit + 1` rows so the service can detect a next page.
   *
   * Filters:
   *   - spike: only mentions where isSpike = true
   *   - sentiment: only mentions with a specific verifiedSentiment
   *   - language: only mentions with a specific detectedLanguage
   */
  async listMentions(
    queryId: string,
    query: MentionListQuery
  ): Promise<ListeningMentionItem[]> {
    const limit = query.limit ?? 20
    const rows = await db.listeningMention.findMany({
      where: {
        queryId,
        ...(query.spike ? { isSpike: true } : {}),
        ...(query.sentiment ? { verifiedSentiment: query.sentiment } : {}),
        ...(query.language ? { detectedLanguage: query.language } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: [{ mentionedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })
    return rows.map(mentionToItem)
  }

  /** Create a new mention (internal: ingestion pipeline). */
  async createMention(
    data: CreateListeningMentionInput
  ): Promise<ListeningMentionItem> {
    const row = await db.listeningMention.create({
      data: {
        queryId: data.queryId,
        workspaceId: data.workspaceId,
        provider: data.provider,
        content: data.content,
        authorName: data.authorName,
        authorAvatar: data.authorAvatar ?? null,
        sourceUrl: data.sourceUrl ?? null,
        likes: data.likes ?? 0,
        comments: data.comments ?? 0,
        shares: data.shares ?? 0,
        detectedLanguage: data.detectedLanguage ?? null,
        spamScore: data.spamScore ?? 0,
        autoSentiment: data.autoSentiment ?? null,
        verifiedSentiment: data.verifiedSentiment ?? null,
        coverageSource: data.coverageSource ?? null,
        mentionedAt: data.mentionedAt,
      },
    })
    return mentionToItem(row)
  }

  /**
   * Count mentions in the spike window (rolling N hours back from `since`).
   * Used by the service for spike detection.
   *
   * Returns an array of `{ bucket: ISO string, count: number }` rows, one per
   * hour, ordered oldest → newest. Buckets with zero mentions are zero-filled.
   */
  async countMentionsByBucket(
    queryId: string,
    since: Date,
    hours: number
  ): Promise<{ bucket: string; count: number }[]> {
    const rows = await db.listeningMention.findMany({
      where: { queryId, mentionedAt: { gte: since } },
      select: { mentionedAt: true },
    })

    // Bucket mentions by hour in JS (avoids dialect-specific SQL date-trunc).
    const buckets = new Map<string, number>()
    for (let i = 0; i < hours; i++) {
      const d = new Date(since)
      d.setHours(since.getHours() + i)
      d.setMinutes(0, 0, 0)
      buckets.set(toHourKey(d), 0)
    }
    for (const row of rows) {
      const d = new Date(row.mentionedAt)
      d.setMinutes(0, 0, 0)
      const key = toHourKey(d)
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([bucket, count]) => ({ bucket, count }))
  }

  /**
   * Mark mentions in the spike window as isSpike=true / false based on a
   * per-mention threshold. Spike score = (bucket count - mean) / stddev.
   *
   * Uses a single UPDATE per state (true / false) — O(2 round-trips).
   */
  async markSpikes(
    queryId: string,
    since: Date,
    flaggedBucketKeys: Set<string>,
    mean: number,
    stddev: number
  ): Promise<{ spiked: number; unflagged: number }> {
    if (flaggedBucketKeys.size === 0) {
      // Clear all spikes in the window for this query.
      const unflagged = await db.listeningMention.updateMany({
        where: { queryId, mentionedAt: { gte: since }, isSpike: true },
        data: { isSpike: false, spikeScore: null },
      })
      return { spiked: 0, unflagged: unflagged.count }
    }

    // Compute per-mention spikeScore = (bucketCount - mean) / stddev.
    // We can't express this in Prisma where-clause directly, so we mark
    // spike=true for any mention whose hour-bucket is in the flagged set.
    // The spikeScore is computed from the bucket count (same for all
    // mentions in the bucket).
    const flaggedBuckets = Array.from(flaggedBucketKeys).map((key) => {
      const [datePart, hourPart] = key.split(' ')
      const d = new Date(`${datePart}T${hourPart}:00:00.000Z`)
      return d
    })

    // Clear spikes for buckets NOT flagged, then set spikes for flagged.
    const unflagged = await db.listeningMention.updateMany({
      where: {
        queryId,
        mentionedAt: { gte: since, not: { in: flaggedBuckets } },
        isSpike: true,
      },
      data: { isSpike: false, spikeScore: null },
    })

    // For each flagged bucket, set isSpike=true and compute spikeScore.
    let spiked = 0
    for (let i = 0; i < flaggedBuckets.length; i++) {
      const bucketStart = flaggedBuckets[i]
      const bucketEnd = new Date(bucketStart.getTime() + 60 * 60 * 1000)
      const bucketKey = toHourKey(bucketStart)
      const [datePart, hourPart] = bucketKey.split(' ')
      void datePart
      void hourPart

      // Look up the count for this bucket from the flagged set — but we
      // need the actual count, so we re-query it. (Cheap: indexed by
      // [queryId, mentionedAt].)
      const countRow = await db.listeningMention.count({
        where: {
          queryId,
          mentionedAt: { gte: bucketStart, lt: bucketEnd },
        },
      })
      const spikeScore =
        stddev > 0 ? (countRow - mean) / stddev : countRow - mean

      const res = await db.listeningMention.updateMany({
        where: {
          queryId,
          mentionedAt: { gte: bucketStart, lt: bucketEnd },
        },
        data: { isSpike: true, spikeScore },
      })
      spiked += res.count
    }

    return { spiked, unflagged: unflagged.count }
  }

  /** Stats: total mentions, spike count, per-provider counts, per-sentiment counts. */
  async getMentionStats(
    queryId: string
  ): Promise<{
    total: number
    spikes: number
    byProvider: Record<string, number>
    byVerifiedSentiment: Record<string, number>
  }> {
    const [total, spikes, byProviderRows, bySentimentRows] = await Promise.all([
      db.listeningMention.count({ where: { queryId } }),
      db.listeningMention.count({ where: { queryId, isSpike: true } }),
      db.listeningMention.groupBy({
        by: ['provider'],
        where: { queryId },
        _count: true,
      }),
      db.listeningMention.groupBy({
        by: ['verifiedSentiment'],
        where: { queryId },
        _count: true,
      }),
    ])

    const byProvider: Record<string, number> = {}
    for (const row of byProviderRows) {
      byProvider[row.provider] = row._count
    }
    const byVerifiedSentiment: Record<string, number> = {}
    for (const row of bySentimentRows) {
      const key = row.verifiedSentiment ?? 'unverified'
      byVerifiedSentiment[key] = row._count
    }

    return { total, spikes, byProvider, byVerifiedSentiment }
  }
}

function toHourKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}`
}

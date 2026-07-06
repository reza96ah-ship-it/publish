/**
 * Issue #255: Public API v1 — read-only service.
 *
 * Thin wrapper around direct DB queries for the public REST API. Routes in
 * `src/app/api/v1/*` import this singleton so route handlers stay thin
 * (architecture boundary test enforces <100 lines per route file) and `db`
 * never appears in a route handler.
 *
 * All methods are workspace-scoped — the `workspaceId` comes from the
 * authenticated ApiToken (see `requireApiToken` in `@/lib/auth-guards`).
 *
 * Cursor pagination follows the same `take limit+1` + slice + derive
 * nextCursor pattern used by the campaigns/notifications/smart-pages
 * modules: rows are ordered by `id desc` so the cursor compares with `lt`.
 */

import { db } from '@/lib/db'
import type {
  CursorListQuery,
  CursorListResult,
  PublicContentItem,
  PublicInboxItem,
  PublicPublicationItem,
  PublicReportDay,
  PublicReportResult,
} from './types'

const DEFAULT_LIMIT = 20
const METRIC_KEYS = [
  'reach',
  'impressions',
  'engagement',
  'followers',
  'clicks',
  'conversions',
] as const

type MetricKey = (typeof METRIC_KEYS)[number]

function paginate<T extends { id: string }>(
  rows: T[],
  limit: number
): CursorListResult<T> {
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null
  return { data: page, nextCursor }
}

function toDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function emptyMetrics(): Record<MetricKey, number> {
  return { reach: 0, impressions: 0, engagement: 0, followers: 0, clicks: 0, conversions: 0 }
}

export class PublicApiService {
  /** List content for the workspace, cursor-paginated by id desc. */
  async listContent(
    workspaceId: string,
    query: CursorListQuery
  ): Promise<CursorListResult<PublicContentItem>> {
    const limit = query.limit ?? DEFAULT_LIMIT
    const rows = await db.content.findMany({
      where: {
        workspaceId,
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      select: {
        id: true,
        title: true,
        body: true,
        hashtags: true,
        status: true,
        authorName: true,
        thumbnailUrl: true,
        scheduledAt: true,
        publishedAt: true,
        updatedAt: true,
      },
    })
    return paginate(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        hashtags: r.hashtags,
        status: r.status,
        authorName: r.authorName,
        thumbnailUrl: r.thumbnailUrl,
        scheduledAt: r.scheduledAt?.toISOString() ?? null,
        publishedAt: r.publishedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
      })),
      limit
    )
  }

  /** Get a single content item, scoped to the workspace. Returns null if not found. */
  async getContent(
    workspaceId: string,
    id: string
  ): Promise<PublicContentItem | null> {
    const r = await db.content.findFirst({
      where: { id, workspaceId },
      select: {
        id: true,
        title: true,
        body: true,
        hashtags: true,
        status: true,
        authorName: true,
        thumbnailUrl: true,
        scheduledAt: true,
        publishedAt: true,
        updatedAt: true,
      },
    })
    if (!r) return null
    return {
      id: r.id,
      title: r.title,
      body: r.body,
      hashtags: r.hashtags,
      status: r.status,
      authorName: r.authorName,
      thumbnailUrl: r.thumbnailUrl,
      scheduledAt: r.scheduledAt?.toISOString() ?? null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      updatedAt: r.updatedAt.toISOString(),
    }
  }

  /** List publications for the workspace, cursor-paginated by id desc. */
  async listPublications(
    workspaceId: string,
    query: CursorListQuery
  ): Promise<CursorListResult<PublicPublicationItem>> {
    const limit = query.limit ?? DEFAULT_LIMIT
    const rows = await db.publication.findMany({
      where: {
        workspaceId,
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: { content: { select: { title: true } } },
    })
    return paginate(
      rows.map((r) => ({
        id: r.id,
        contentId: r.contentId,
        contentTitle: r.content.title,
        platformId: r.platformId,
        status: r.status,
        scheduledAt: r.scheduledAt?.toISOString() ?? null,
        providerPostId: r.providerPostId,
        completedAt: r.completedAt?.toISOString() ?? null,
        errorCategory: r.errorCategory,
        errorMessage: r.errorMessage,
        createdAt: r.createdAt.toISOString(),
      })),
      limit
    )
  }

  /** List inbox messages — unread first, then by id desc. Cursor-paginated. */
  async listInbox(
    workspaceId: string,
    query: CursorListQuery
  ): Promise<CursorListResult<PublicInboxItem>> {
    const limit = query.limit ?? DEFAULT_LIMIT
    const rows = await db.inboxMessage.findMany({
      where: {
        workspaceId,
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      // unread (isRead=false) sorts before read (isRead=true) in ascending order
      orderBy: [{ isRead: 'asc' }, { id: 'desc' }],
      take: limit + 1,
      include: { platform: { select: { type: true, name: true } } },
    })
    return paginate(
      rows.map((m) => ({
        id: m.id,
        senderName: m.senderName,
        message: m.message,
        isRead: m.isRead,
        isReplied: m.isReplied,
        reply: m.reply,
        platform: m.platform?.type ?? m.platformType,
        platformName: m.platform?.name ?? m.platformType,
        messageType: m.messageType,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      })),
      limit
    )
  }

  /**
   * Aggregated analytics report for the last `days` days.
   * Zero-fills missing days so consumers always get a contiguous range.
   */
  async getReport(workspaceId: string, days: number): Promise<PublicReportResult> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const since = new Date(today)
    since.setDate(since.getDate() - (days - 1))

    const snapshots = await db.analyticsSnapshot.findMany({
      where: { workspaceId, date: { gte: toDayKey(since) } },
      select: { date: true, metricType: true, value: true },
    })

    // Bucket by YYYY-MM-DD
    const buckets = new Map<string, Record<MetricKey, number>>()
    for (let i = 0; i < days; i++) {
      const d = new Date(since)
      d.setDate(since.getDate() + i)
      buckets.set(toDayKey(d), emptyMetrics())
    }
    for (const s of snapshots) {
      const b = buckets.get(s.date)
      if (!b) continue
      if ((METRIC_KEYS as readonly string[]).includes(s.metricType)) {
        b[s.metricType as MetricKey] += s.value
      }
    }

    const daily: PublicReportDay[] = []
    const totals = emptyMetrics()
    for (let i = 0; i < days; i++) {
      const d = new Date(since)
      d.setDate(since.getDate() + i)
      const key = toDayKey(d)
      const metrics = buckets.get(key) ?? emptyMetrics()
      daily.push({ date: key, metrics })
      for (const k of METRIC_KEYS) totals[k] += metrics[k]
    }

    return { days, totals, daily }
  }
}

export const publicApiService = new PublicApiService()

/**
 * Analytics Collector — pulls real Instagram numbers into the dashboards.
 *
 * Before this collector, the analytics views only ever showed prisma/seed.ts
 * demo data: AnalyticsSnapshot rows were seeded once and never refreshed, and
 * per-post metrics existed only behind an on-demand endpoint nothing called.
 *
 * Runs every 6 hours inside the publish-worker. For each active Instagram
 * platform with a token:
 *   1. Account level — fetches total followers (GET /{ig-user-id}?fields=
 *      followers_count) and daily reach/impressions (GET /{ig-user-id}/insights)
 *      and upserts today's AnalyticsSnapshot rows, both the per-platform row
 *      (platform='instagram') and the workspace aggregate (platform=NULL, the
 *      row the "all platforms" dashboard filter reads).
 *   2. Post level — fetches reach/likes/comments/saved for recent successful
 *      publications and upserts PostMetricSnapshot rows (same data the
 *      on-demand /api/analytics/per-post/collect endpoint produces).
 *
 * Multiple runs per day simply refresh today's rows (upsert semantics).
 *
 * NULL-platform caveat: the @@unique([workspaceId, date, platform, metricType])
 * index treats NULLs as distinct in Postgres, so Prisma upsert would insert a
 * duplicate aggregate row on every run — aggregate rows use an explicit
 * find-then-update instead.
 */

import { db } from './db'
import { decrypt } from './crypto'
import { fetchWithTimeout } from './fetch-with-timeout'

const IG_GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || 'v23.0'
const GRAPH_API = `https://graph.facebook.com/${IG_GRAPH_VERSION}`

const COLLECT_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours
const PUBLICATIONS_PER_PLATFORM = 25

/** Account-level metrics keyed by AnalyticsSnapshot.metricType. */
export type AccountMetrics = Partial<Record<'followers' | 'reach' | 'engagement', number>>
/** Per-post metrics keyed by PostMetricSnapshot.metricType. */
export type PostMetrics = Partial<Record<'reach' | 'likes' | 'comments' | 'saved', number>>

export interface CollectorDeps {
  fetchAccountMetrics?: typeof fetchAccountMetrics
  fetchPostMetrics?: typeof fetchPostMetrics
}

export interface CollectorStats {
  platformsScanned: number
  accountSnapshotsWritten: number
  postsCollected: number
  errors: number
}

let collectTimer: ReturnType<typeof setInterval> | null = null
let collectInProgress = false

export function startAnalyticsCollector(): void {
  if (collectTimer) return
  // First run 60s after boot, then every 6h.
  setTimeout(() => {
    collectAnalytics().catch((err) =>
      console.error('[analytics-collector] initial run failed:', err)
    )
  }, 60_000)
  collectTimer = setInterval(() => {
    collectAnalytics().catch((err) =>
      console.error('[analytics-collector] scheduled run failed:', err)
    )
  }, COLLECT_INTERVAL_MS)
  console.log('[analytics-collector] started — refreshes IG analytics every 6h')
}

export function stopAnalyticsCollector(): void {
  if (collectTimer) {
    clearInterval(collectTimer)
    collectTimer = null
    console.log('[analytics-collector] stopped')
  }
}

/** Run one full collection cycle. Exported for unit testing. */
export async function collectAnalytics(
  now: Date = new Date(),
  deps: CollectorDeps = {}
): Promise<CollectorStats> {
  const stats: CollectorStats = {
    platformsScanned: 0,
    accountSnapshotsWritten: 0,
    postsCollected: 0,
    errors: 0,
  }

  if (collectInProgress) {
    console.warn('[analytics-collector] previous run still in progress — skipping cycle')
    return stats
  }
  collectInProgress = true
  try {
    return await collectInner(now, deps, stats)
  } finally {
    collectInProgress = false
  }
}

async function collectInner(
  now: Date,
  deps: CollectorDeps,
  stats: CollectorStats
): Promise<CollectorStats> {
  const fetchAccountFn = deps.fetchAccountMetrics ?? fetchAccountMetrics
  const fetchPostFn = deps.fetchPostMetrics ?? fetchPostMetrics
  const today = now.toISOString().slice(0, 10)

  const platforms = await db.platform.findMany({
    where: {
      type: 'instagram',
      status: 'active',
      tokenSecret: { not: null },
      targetId: { not: null },
    },
    select: { id: true, workspaceId: true, tokenSecret: true, targetId: true, name: true },
  })

  // Account-level totals per workspace (a workspace can have several IG accounts).
  const workspaceTotals = new Map<string, AccountMetrics>()

  for (const platform of platforms) {
    stats.platformsScanned++
    if (!platform.tokenSecret || !platform.targetId) continue

    let token: string
    try {
      token = decrypt(platform.tokenSecret)
    } catch (err) {
      console.error(
        `[analytics-collector] platform ${platform.id}: token decrypt failed:`,
        (err as Error).message
      )
      stats.errors++
      continue
    }

    // 1. Account metrics → workspace totals.
    try {
      const metrics = await fetchAccountFn(token, platform.targetId)
      const totals = workspaceTotals.get(platform.workspaceId) ?? {}
      for (const [key, value] of Object.entries(metrics) as [keyof AccountMetrics, number][]) {
        totals[key] = (totals[key] ?? 0) + value
      }
      workspaceTotals.set(platform.workspaceId, totals)
    } catch (err) {
      console.error(
        `[analytics-collector] platform ${platform.id}: account insights failed:`,
        (err as Error).message
      )
      stats.errors++
    }

    // 2. Per-post metrics.
    try {
      stats.postsCollected += await collectPlatformPostMetrics(platform, token, today, fetchPostFn)
    } catch (err) {
      console.error(
        `[analytics-collector] platform ${platform.id}: post metrics failed:`,
        (err as Error).message
      )
      stats.errors++
    }
  }

  // 3. Write account snapshots: per-platform-type row + NULL aggregate row.
  for (const [workspaceId, totals] of workspaceTotals) {
    for (const [metricType, value] of Object.entries(totals) as [string, number][]) {
      try {
        await upsertSnapshot(workspaceId, today, 'instagram', metricType, value)
        await upsertSnapshot(workspaceId, today, null, metricType, value)
        stats.accountSnapshotsWritten++
      } catch (err) {
        console.error(
          `[analytics-collector] snapshot write failed (${workspaceId} ${metricType}):`,
          (err as Error).message
        )
        stats.errors++
      }
    }
  }

  if (stats.accountSnapshotsWritten > 0 || stats.postsCollected > 0) {
    console.log(
      `[analytics-collector] cycle complete — platforms:${stats.platformsScanned} snapshots:${stats.accountSnapshotsWritten} posts:${stats.postsCollected} errors:${stats.errors}`
    )
  }
  return stats
}

/**
 * Upsert one AnalyticsSnapshot row. Uses find-then-update because the unique
 * index treats NULL platform values as distinct (see module doc).
 */
async function upsertSnapshot(
  workspaceId: string,
  date: string,
  platform: string | null,
  metricType: string,
  value: number
): Promise<void> {
  const existing = await db.analyticsSnapshot.findFirst({
    where: { workspaceId, date, platform, metricType },
    select: { id: true },
  })
  if (existing) {
    await db.analyticsSnapshot.update({ where: { id: existing.id }, data: { value } })
  } else {
    await db.analyticsSnapshot.create({
      data: { workspaceId, date, platform, metricType, value },
    })
  }
}

interface PlatformRow {
  id: string
  workspaceId: string
  name: string
}

async function collectPlatformPostMetrics(
  platform: PlatformRow,
  token: string,
  today: string,
  fetchPostFn: typeof fetchPostMetrics
): Promise<number> {
  const publications = await db.publication.findMany({
    where: {
      platformId: platform.id,
      status: 'success',
      providerPostId: { not: null },
    },
    orderBy: { completedAt: 'desc' },
    take: PUBLICATIONS_PER_PLATFORM,
    select: { id: true, providerPostId: true },
  })

  let collected = 0
  for (const pub of publications) {
    if (!pub.providerPostId) continue
    let metrics: PostMetrics
    try {
      metrics = await fetchPostFn(token, pub.providerPostId)
    } catch (err) {
      console.error(
        `[analytics-collector] post ${pub.providerPostId}: insights failed:`,
        (err as Error).message
      )
      continue
    }

    for (const [metricType, value] of Object.entries(metrics) as [string, number][]) {
      await db.postMetricSnapshot.upsert({
        where: {
          publicationId_date_metricType: { publicationId: pub.id, date: today, metricType },
        },
        create: { workspaceId: platform.workspaceId, publicationId: pub.id, date: today, metricType, value },
        update: { value },
      })
    }
    collected++
  }
  return collected
}

/**
 * Fetch account-level metrics from the Graph API.
 *   - followers: total follower count (/{ig-user-id}?fields=followers_count —
 *     the *total*, unlike the follower_count insight which is daily deltas)
 *   - reach / engagement(impressions): daily insights
 */
export async function fetchAccountMetrics(
  token: string,
  igUserId: string
): Promise<AccountMetrics> {
  const metrics: AccountMetrics = {}

  const profileRes = await fetchWithTimeout(
    `${GRAPH_API}/${igUserId}?fields=followers_count&access_token=${token}`
  )
  const profile = (await profileRes.json()) as { error?: { message?: string }; followers_count?: number }
  if (profile.error) {
    throw new Error(`IG profile fetch failed: ${profile.error.message ?? 'unknown error'}`)
  }
  if (typeof profile.followers_count === 'number') metrics.followers = profile.followers_count

  const insightsRes = await fetchWithTimeout(
    `${GRAPH_API}/${igUserId}/insights?metric=reach,impressions&period=day&access_token=${token}`
  )
  const insights = (await insightsRes.json()) as {
    error?: { message?: string }
    data?: { name: string; values?: { value?: number }[] }[]
  }
  // Insights can fail independently (e.g. account too small) — keep followers.
  if (!insights.error) {
    for (const item of insights.data ?? []) {
      const value = item.values?.[item.values.length - 1]?.value
      if (typeof value !== 'number') continue
      if (item.name === 'reach') metrics.reach = value
      if (item.name === 'impressions') metrics.engagement = value
    }
  }

  return metrics
}

/** Fetch per-post insights (reach, likes, comments, saved) for one media. */
export async function fetchPostMetrics(token: string, mediaId: string): Promise<PostMetrics> {
  const res = await fetchWithTimeout(
    `${GRAPH_API}/${mediaId}/insights?metric=reach,likes,comments,saved&access_token=${token}`
  )
  const data = (await res.json()) as {
    error?: { message?: string }
    data?: { name: string; values?: { value?: number }[] }[]
  }
  if (data.error) {
    throw new Error(`IG post insights failed: ${data.error.message ?? 'unknown error'}`)
  }
  const metrics: PostMetrics = {}
  for (const item of data.data ?? []) {
    const value = item.values?.[0]?.value
    if (typeof value !== 'number') continue
    if (item.name === 'reach' || item.name === 'likes' || item.name === 'comments' || item.name === 'saved') {
      metrics[item.name] = value
    }
  }
  return metrics
}

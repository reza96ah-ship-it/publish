/**
 * Issue #215: per-post metric collection.
 *
 * Providers differ in what per-post insights their API exposes. This module is
 * the single source of truth for that support matrix, plus the collector that
 * pulls insights for recently published publications and stores them as
 * PostMetricSnapshot rows. Providers with no per-post API simply produce no
 * rows — the UI renders an honest "not available" state from the matrix.
 */

import { db } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import {
  POST_METRIC_TYPES,
  getPostMetricsSupport,
  type PostMetricType,
} from './post-metrics-shared'
import { buildInstagramGraphApiUrl } from '../../../shared/instagram-graph'

export { getPostMetricsSupport }
export type { PostMetricType }

interface CollectResult {
  collected: number
  skipped: number
  errors: number
}

/**
 * Pull today's per-post insights for the workspace's recent successful
 * publications, where the provider exposes them. Currently Instagram only.
 */
export async function collectPostMetrics(workspaceId: string): Promise<CollectResult> {
  const result: CollectResult = { collected: 0, skipped: 0, errors: 0 }

  const publications = await db.publication.findMany({
    where: {
      workspaceId,
      status: 'success',
      providerPostId: { not: null },
    },
    orderBy: { completedAt: 'desc' },
    take: 25,
    select: { id: true, providerPostId: true, platformId: true },
  })
  if (publications.length === 0) return result

  const platformIds = [...new Set(publications.map((p) => p.platformId))]
  const platforms = await db.platform.findMany({
    where: { id: { in: platformIds } },
    select: { id: true, type: true, tokenSecret: true },
  })
  const platformMap = new Map(platforms.map((p) => [p.id, p]))

  const today = new Date().toISOString().split('T')[0]

  for (const pub of publications) {
    const platform = platformMap.get(pub.platformId)
    const support = getPostMetricsSupport(platform?.type ?? '')
    if (!platform || support.metrics.length === 0 || !platform.tokenSecret) {
      result.skipped++
      continue
    }

    try {
      if (platform.type === 'instagram') {
        const token = decrypt(platform.tokenSecret)
        const params = new URLSearchParams({
          metric: 'reach,likes,comments,saved',
          access_token: token,
        })
        const res = await fetch(
          buildInstagramGraphApiUrl(`${pub.providerPostId}/insights?${params}`)
        )
        const data = (await res.json()) as {
          error?: unknown
          data?: { name: string; values: { value: number }[] }[]
        }
        if (data.error || !data.data) {
          result.errors++
          continue
        }
        for (const item of data.data) {
          const value = item.values?.[0]?.value
          if (typeof value !== 'number') continue
          await db.postMetricSnapshot.upsert({
            where: {
              publicationId_date_metricType: {
                publicationId: pub.id,
                date: today,
                metricType: item.name,
              },
            },
            create: {
              workspaceId,
              publicationId: pub.id,
              date: today,
              metricType: item.name,
              value,
            },
            update: { value },
          })
        }
        result.collected++
      }
    } catch {
      result.errors++
    }
  }

  return result
}

/**
 * Latest value per metric for each publication — one map entry per post.
 */
export async function getLatestPostMetrics(
  workspaceId: string,
  publicationIds: string[]
): Promise<Map<string, Partial<Record<PostMetricType, number>>>> {
  const map = new Map<string, Partial<Record<PostMetricType, number>>>()
  if (publicationIds.length === 0) return map

  const snapshots = await db.postMetricSnapshot.findMany({
    where: { workspaceId, publicationId: { in: publicationIds } },
    orderBy: { date: 'asc' }, // later rows overwrite → latest wins
    select: { publicationId: true, metricType: true, value: true },
  })
  for (const s of snapshots) {
    const entry = map.get(s.publicationId) ?? {}
    entry[s.metricType as PostMetricType] = s.value
    map.set(s.publicationId, entry)
  }
  return map
}

/**
 * Full daily series for one publication, shaped for charting.
 */
export async function getPostMetricSeries(workspaceId: string, publicationId: string) {
  const snapshots = await db.postMetricSnapshot.findMany({
    where: { workspaceId, publicationId },
    orderBy: { date: 'asc' },
    select: { date: true, metricType: true, value: true },
  })
  const dates = [...new Set(snapshots.map((s) => s.date))]
  const series: Partial<Record<PostMetricType, number[]>> = {}
  for (const metric of POST_METRIC_TYPES) {
    const values = dates.map(
      (d) => snapshots.find((s) => s.date === d && s.metricType === metric)?.value ?? 0
    )
    if (values.some((v) => v > 0)) series[metric] = values
  }
  return { dates, series }
}

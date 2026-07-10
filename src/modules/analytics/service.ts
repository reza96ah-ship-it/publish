/**
 * Analytics domain module — service layer.
 * Business logic for snapshot series + real provider stats.
 * No HTTP. No direct Prisma.
 */

import { decrypt } from '@/lib/crypto'
import { AnalyticsRepository } from './repository'
import type { AuthContext, RealStat, RealStatsResult, SnapshotSeriesResult } from './types'
import { buildInstagramGraphApiUrl } from '../../../shared/instagram-graph'

export class AnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepository = new AnalyticsRepository()
  ) {}

  async getSnapshotSeries(
    auth: AuthContext,
    platform: string | undefined
  ): Promise<SnapshotSeriesResult> {
    const snapshots = await this.repo.findSnapshots(auth.workspaceId, platform, 30)
    const dates = [...new Set(snapshots.map((s) => s.date))].sort()
    const series = (metric: string) =>
      dates.map((d) => snapshots.find((s) => s.date === d && s.metricType === metric)?.value ?? 0)
    return {
      dates,
      reach: series('reach'),
      engagement: series('engagement'),
      followers: series('followers'),
      clicks: series('clicks'),
    }
  }

  async getRealStats(auth: AuthContext): Promise<RealStatsResult> {
    const { workspaceId } = auth
    const platforms = await this.repo.findConnectedPlatforms(workspaceId)
    const realStats: Record<string, RealStat> = {}

    for (const platform of platforms) {
      if (!platform.tokenSecret) continue
      const token = decrypt(platform.tokenSecret)

      try {
        if (platform.type === 'telegram' && platform.targetId) {
          const res = await fetch('https://api.telegram.org/bot' + token + '/getChatMemberCount', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: platform.targetId }),
          })
          const data = await res.json() as { ok: boolean; result?: number }
          if (data.ok) {
            realStats[platform.type] = { followers: data.result, source: 'telegram_api' }
          }
        } else if (platform.type === 'bale' && platform.targetId) {
          const res = await fetch('https://tapi.bale.ai/bot' + token + '/getChatMemberCount', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: platform.targetId }),
          })
          const data = await res.json() as { ok: boolean; result?: number }
          if (data.ok) {
            realStats[platform.type] = { followers: data.result, source: 'bale_api' }
          }
        } else if (platform.type === 'instagram' && platform.targetId) {
          const igUserId = platform.targetId
          const params = new URLSearchParams({
            metric: 'follower_count,reach,impressions',
            period: 'day',
            access_token: token,
          })
          const res = await fetch(buildInstagramGraphApiUrl(`${igUserId}/insights?${params}`))
          const data = await res.json() as { error?: unknown; data?: { name: string; values: { value: number }[] }[] }
          if (!data.error) {
            const metrics: Record<string, number> = {}
            for (const item of data.data || []) {
              if (item.values?.[0]?.value) metrics[item.name] = item.values[0].value
            }
            realStats[platform.type] = {
              followers: metrics.follower_count,
              reach: metrics.reach,
              engagement: metrics.impressions,
              source: 'instagram_graph_api',
            }
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[analytics] ${platform.type} error:`, err)
      }
    }

    const since = new Date(Date.now() - 7 * 86400_000).toISOString().split('T')[0]
    const dbSnapshots = await this.repo.findRecentSnapshots(workspaceId, since)

    return {
      real: realStats,
      fallback: dbSnapshots.map((s) => ({
        date: s.date,
        platform: s.platform,
        metric: s.metricType,
        value: s.value,
      })),
      hasRealData: Object.keys(realStats).length > 0,
    }
  }
}

export const analyticsService = new AnalyticsService()

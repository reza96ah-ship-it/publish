import { db } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import type { PlatformRealStat, RealAnalyticsResult } from './types'

async function fetchPlatformStat(
  type: string,
  token: string,
  targetId: string | null
): Promise<PlatformRealStat | null> {
  try {
    if (type === 'telegram' && targetId) {
      const res = await fetch(`https://api.telegram.org/bot${token}/getChatMemberCount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: targetId }),
      })
      const data = await res.json()
      if (data.ok) return { followers: data.result, source: 'telegram_api' }
    } else if (type === 'bale' && targetId) {
      const res = await fetch(`https://tapi.bale.ai/bot${token}/getChatMemberCount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: targetId }),
      })
      const data = await res.json()
      if (data.ok) return { followers: data.result, source: 'bale_api' }
    } else if (type === 'instagram' && targetId) {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${targetId}/insights?metric=follower_count,reach,impressions&period=day&access_token=${token}`
      )
      const data = await res.json()
      if (!data.error) {
        const metrics: Record<string, number> = {}
        for (const item of data.data ?? []) {
          if (item.values?.[0]?.value) metrics[item.name] = item.values[0].value
        }
        return {
          followers: metrics.follower_count,
          reach: metrics.reach,
          engagement: metrics.impressions,
          source: 'instagram_graph_api',
        }
      }
    }
  } catch (err) {
    console.error(`[analytics] ${type} error:`, err)
  }
  return null
}

class AnalyticsService {
  async fetchRealStats(workspaceId: string): Promise<RealAnalyticsResult> {
    const platforms = await db.platform.findMany({
      where: { workspaceId, tokenSecret: { not: null } },
    })

    const real: Record<string, PlatformRealStat> = {}
    for (const p of platforms) {
      if (!p.tokenSecret) continue
      const stat = await fetchPlatformStat(p.type, decrypt(p.tokenSecret), p.targetId)
      if (stat) real[p.type] = stat
    }

    const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]
    const dbSnapshots = await db.analyticsSnapshot.findMany({
      where: { workspaceId, date: { gte: cutoff } },
      orderBy: { date: 'desc' },
      take: 50,
    })

    return {
      real,
      fallback: dbSnapshots.map((s) => ({
        date: s.date,
        platform: s.platform,
        metric: s.metricType,
        value: s.value,
      })),
      hasRealData: Object.keys(real).length > 0,
    }
  }
}

export const analyticsService = new AnalyticsService()

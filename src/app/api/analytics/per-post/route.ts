/**
 * GET /api/analytics/per-post — per-post performance drill-down.
 * Issue #215: Returns published posts with platform + campaign info.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { getLatestPostMetrics, getPostMetricsSupport } from '@/modules/analytics/post-metrics'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const campaignId = req.nextUrl.searchParams.get('campaignId') ?? undefined
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 100)

  const publications = await db.publication.findMany({
    where: {
      workspaceId: guard.workspaceId,
      status: 'success',
      ...(campaignId ? { campaignId } : {}),
    },
    orderBy: { completedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      platformId: true,
      contentId: true,
      campaignId: true,
      providerPostId: true,
      scheduledAt: true,
      completedAt: true,
    },
  })

  // Bulk fetch related data
  const platformIds = [...new Set(publications.map(p => p.platformId))]
  const contentIds = [...new Set(publications.map(p => p.contentId))]
  const campaignIds = [...new Set(publications.filter(p => p.campaignId).map(p => p.campaignId!))]

  const [platforms, contents, campaigns] = await Promise.all([
    db.platform.findMany({ where: { id: { in: platformIds } }, select: { id: true, type: true, name: true } }),
    db.content.findMany({ where: { id: { in: contentIds } }, select: { id: true, title: true } }),
    db.campaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true } }),
  ])

  const platformMap = new Map(platforms.map(p => [p.id, p]))
  const contentMap = new Map(contents.map(c => [c.id, c]))
  const campaignMap = new Map(campaigns.map(c => [c.id, c]))

  // Issue #215: latest collected metric values per publication
  const metricsMap = await getLatestPostMetrics(guard.workspaceId, publications.map(p => p.id))

  const posts = publications.map((p) => {
    const platformType = platformMap.get(p.platformId)?.type ?? 'unknown'
    return {
      id: p.id,
      title: contentMap.get(p.contentId)?.title ?? 'بدون عنوان',
      platform: platformType,
      platformName: platformMap.get(p.platformId)?.name ?? 'نامشخص',
      providerPostId: p.providerPostId,
      publishedAt: p.completedAt,
      scheduledAt: p.scheduledAt,
      campaign: p.campaignId ? (campaignMap.get(p.campaignId)?.name ?? null) : null,
      metrics: metricsMap.get(p.id) ?? {},
      metricsSupported: getPostMetricsSupport(platformType).metrics.length > 0,
    }
  })

  // Campaign ROI rollup: post count + summed metrics + top posts by reach
  const byCampaign: Record<
    string,
    { name: string; count: number; reach: number; engagement: number; topPosts: { id: string; title: string; reach: number }[] }
  > = {}
  for (const p of posts) {
    const cName = p.campaign ?? 'بدون کمپین'
    if (!byCampaign[cName]) {
      byCampaign[cName] = { name: cName, count: 0, reach: 0, engagement: 0, topPosts: [] }
    }
    const c = byCampaign[cName]
    c.count++
    const reach = p.metrics.reach ?? 0
    c.reach += reach
    c.engagement += (p.metrics.likes ?? 0) + (p.metrics.comments ?? 0) + (p.metrics.saved ?? 0)
    c.topPosts.push({ id: p.id, title: p.title, reach })
  }
  for (const c of Object.values(byCampaign)) {
    c.topPosts = c.topPosts.sort((a, b) => b.reach - a.reach).slice(0, 3)
  }

  return NextResponse.json({
    posts,
    campaigns: Object.values(byCampaign).sort((a, b) => b.reach - a.reach),
    total: posts.length,
  })
}

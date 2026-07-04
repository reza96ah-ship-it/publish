/**
 * GET /api/analytics/per-post — per-post performance drill-down.
 * Issue #215: Returns published posts with platform + campaign info.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'

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

  const posts = publications.map((p) => ({
    id: p.id,
    title: contentMap.get(p.contentId)?.title ?? 'بدون عنوان',
    platform: platformMap.get(p.platformId)?.type ?? 'unknown',
    platformName: platformMap.get(p.platformId)?.name ?? 'نامشخص',
    providerPostId: p.providerPostId,
    publishedAt: p.completedAt,
    scheduledAt: p.scheduledAt,
    campaign: p.campaignId ? (campaignMap.get(p.campaignId)?.name ?? null) : null,
  }))

  // Group by campaign for ROI rollup
  const byCampaign: Record<string, { name: string; count: number }> = {}
  for (const p of posts) {
    const cName = p.campaign ?? 'بدون کمپین'
    if (!byCampaign[cName]) byCampaign[cName] = { name: cName, count: 0 }
    byCampaign[cName].count++
  }

  return NextResponse.json({
    posts,
    campaigns: Object.values(byCampaign),
    total: posts.length,
  })
}

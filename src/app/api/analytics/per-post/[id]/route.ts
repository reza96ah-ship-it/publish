/**
 * GET /api/analytics/per-post/[id] — Issue #215: metric timeline for one
 * publication, plus the provider's support matrix so the UI can render an
 * honest "not available" state per provider.
 */
import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { getPostMetricSeries, getPostMetricsSupport } from '@/modules/analytics/post-metrics'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const { id } = await params
  const publication = await db.publication.findFirst({
    where: { id, workspaceId: guard.workspaceId },
    select: {
      id: true,
      contentId: true,
      platformId: true,
      campaignId: true,
      providerPostId: true,
      completedAt: true,
    },
  })
  if (!publication) {
    return NextResponse.json({ error: 'انتشار پیدا نشد' }, { status: 404 })
  }

  const [content, platform, campaign, timeline] = await Promise.all([
    db.content.findUnique({
      where: { id: publication.contentId },
      select: { title: true, thumbnailUrl: true },
    }),
    db.platform.findUnique({
      where: { id: publication.platformId },
      select: { type: true, name: true },
    }),
    publication.campaignId
      ? db.campaign.findUnique({ where: { id: publication.campaignId }, select: { name: true } })
      : Promise.resolve(null),
    getPostMetricSeries(guard.workspaceId, id),
  ])

  const support = getPostMetricsSupport(platform?.type ?? '')

  return NextResponse.json({
    id: publication.id,
    title: content?.title ?? 'بدون عنوان',
    thumbnail: content?.thumbnailUrl ?? '',
    platform: platform?.type ?? 'unknown',
    platformName: platform?.name ?? 'نامشخص',
    campaign: campaign?.name ?? null,
    publishedAt: publication.completedAt,
    providerPostId: publication.providerPostId,
    support,
    timeline,
  })
}

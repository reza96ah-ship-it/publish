import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi, requireAnyPermissionApi } from '@/lib/auth-guards'
import { validateParams, contentListQuerySchema, cursorPaginationSchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Approvers need content.review (not content.create) to list items they must approve
  const guard = await requireAnyPermissionApi(['content.create', 'content.review'])
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  // Validate query params: status, campaignId, cursor, limit
  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(contentListQuerySchema.merge(cursorPaginationSchema), query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  const { status, campaignId, cursor, limit } = queryCheck.data

  const items = await db.content.findMany({
    where: {
      workspaceId,
      ...(status ? { status } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(cursor ? { id: { lt: cursor } } : {}), // cursor pagination
    },
    include: {
      platforms: { include: { platform: { select: { type: true } } } },
      campaign: { select: { name: true } },
    },
    orderBy: { id: 'desc' },
    take: limit + 1, // fetch 1 extra to check if there's a next page
  })

  const hasMore = items.length > limit
  const data = hasMore ? items.slice(0, limit) : items
  const nextCursor = hasMore ? data[data.length - 1]?.id : null

  return NextResponse.json({
    data: data.map((c) => ({
      id: c.id,
      title: c.title,
      body: c.body,
      hashtags: c.hashtags,
      status: c.status,
      authorName: c.authorName,
      thumbnail: c.thumbnailUrl,
      campaign: c.campaign?.name ?? 'بدون کمپین',
      platforms: c.platforms.map((p) => p.platform.type),
      scheduledAt: c.scheduledAt,
      publishedAt: c.publishedAt,
      updatedAt: c.updatedAt,
    })),
    nextCursor,
  })
}

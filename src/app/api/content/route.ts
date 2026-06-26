import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getWorkspaceId } from '@/lib/server'
import { validateParams, contentListQuerySchema } from '@/lib/validations'

export async function GET(req: NextRequest) {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return NextResponse.json({ error: 'workspace not found' }, { status: 404 })

  // Validate ?status= and ?campaignId= query params (both optional)
  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(contentListQuerySchema, query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  const { status, campaignId } = queryCheck.data

  const items = await db.content.findMany({
    where: {
      workspaceId,
      ...(status ? { status } : {}),
      ...(campaignId ? { campaignId } : {}),
    },
    include: {
      platforms: { include: { platform: { select: { type: true } } } },
      campaign: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(items.map((c) => ({
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
  })))
}

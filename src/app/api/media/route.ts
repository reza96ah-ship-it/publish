import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi, requireAnyPermissionApi } from '@/lib/auth-guards'
import { validateParams, cursorPaginationSchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Approvers reviewing content need to see attached media (content.review)
  const guard = await requireAnyPermissionApi(['media.upload', 'content.review'])
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  const { cursor, limit } = queryCheck.data

  const items = await db.media.findMany({
    where: {
      workspaceId,
      status: 'validated', // Issue #146: pending/rejected/deleting assets are never listed
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { id: 'desc' },
    take: limit + 1,
  })

  const hasMore = items.length > limit
  const data = hasMore ? items.slice(0, limit) : items
  const nextCursor = hasMore ? data[data.length - 1]?.id : null

  return NextResponse.json({
    data: data.map((m) => ({
      id: m.id,
      name: m.name,
      fileType: m.fileType,
      fileSize: m.fileSize,
      url: m.url,
      thumbnail: m.thumbnailUrl ?? m.url,
      folder: m.folder,
      tags: m.tags ? m.tags.split(',').filter(Boolean) : [],
      width: m.width,
      height: m.height,
      createdAt: m.createdAt,
    })),
    nextCursor,
  })
}

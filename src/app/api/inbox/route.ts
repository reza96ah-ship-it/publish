import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import { validateParams, cursorPaginationSchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  // Cursor pagination
  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  const { cursor, limit } = queryCheck.data

  const items = await db.inboxMessage.findMany({
    where: {
      workspaceId,
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    include: {
      platform: { select: { type: true, name: true } },
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
      senderName: m.senderName,
      senderAvatar: m.senderAvatar,
      message: m.message,
      isRead: m.isRead,
      isReplied: m.isReplied,
      reply: m.reply,
      platform: m.platform?.type ?? m.platformType,
      platformName: m.platform?.name ?? m.platformType,
      messageType: m.messageType,
      assigneeId: m.assigneeId,
      createdAt: m.createdAt,
    })),
    nextCursor,
  })
}

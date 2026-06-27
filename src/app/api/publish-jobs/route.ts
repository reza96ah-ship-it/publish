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

  const jobs = await db.publishJob.findMany({
    where: {
      workspaceId,
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    include: {
      content: { select: { title: true, thumbnailUrl: true } },
      platform: { select: { type: true, name: true } },
      campaign: { select: { name: true } },
    },
    orderBy: { id: 'desc' },
    take: limit + 1,
  })

  const hasMore = jobs.length > limit
  const data = hasMore ? jobs.slice(0, limit) : jobs
  const nextCursor = hasMore ? data[data.length - 1]?.id : null

  return NextResponse.json({
    data: data.map((j) => ({
      id: j.id,
      title: j.content?.title ?? 'ط¨ط¯ظˆظ† ط¹ظ†ظˆط§ظ†',
      thumbnail: j.content?.thumbnailUrl ?? j.thumbnailUrl ?? '',
      platform: j.platform?.type ?? 'unknown',
      platformName: j.platform?.name ?? 'unknown',
      status: j.status,
      statusLabel: statusLabel(j.status),
      progress: j.progress,
      processLabel: j.processLabel,
      scheduledAt: j.scheduledAt,
      completedAt: j.completedAt,
      error: j.error,
      retryCount: j.retryCount,
      campaign: j.campaign?.name ?? 'ط¨ط¯ظˆظ† ع©ظ…ظ¾غŒظ†',
    })),
    nextCursor,
  })
}

function statusLabel(s: string) {
  switch (s) {
    case 'processing': return 'ط¯ط± ط­ط§ظ„ ظ¾ط±ط¯ط§ط²ط´'
    case 'success': return 'ظ…ظ†طھط´ط± ط´ط¯'
    case 'failed': return 'ظ†ط§ظ…ظˆظپظ‚'
    case 'action': return 'ظ†غŒط§ط²ظ…ظ†ط¯ ط§ظ‚ط¯ط§ظ…'
    case 'scheduled': return 'ط¨ط±ظ†ط§ظ…ظ‡â€Œط±غŒط²غŒ ط´ط¯ظ‡'
    case 'pending': return 'ط¯ط± ط§ظ†طھط¸ط§ط±'
    default: return s
  }
}

/**
 * GET /api/ig-grid?platformId=... — Issue #219: Instagram grid preview data.
 * Returns upcoming (scheduled/pending) and recently published posts for one
 * Instagram channel, in profile-grid order (newest first). Scheduled items
 * whose slot is still in the future are flagged reorderable so the client
 * can drag-reorder them (slot times get swapped via PATCH /api/publish-jobs/[id]).
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateParams } from '@/lib/validations'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const gridQuerySchema = z.object({
  platformId: z.string().min(1, 'شناسه کانال الزامی است'),
})

export interface IgGridItem {
  jobId: string
  contentId: string
  title: string
  thumbnail: string
  kind: 'scheduled' | 'published'
  at: string | null
  reorderable: boolean
}

export async function GET(req: Request) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const { searchParams } = new URL(req.url)
  const paramCheck = validateParams(gridQuerySchema, {
    platformId: searchParams.get('platformId') ?? '',
  })
  if (!paramCheck.success) {
    return NextResponse.json({ error: paramCheck.error }, { status: 400 })
  }
  const { platformId } = paramCheck.data

  const platform = await db.platform.findFirst({
    where: { id: platformId, workspaceId },
    select: { id: true, type: true },
  })
  if (!platform) {
    return NextResponse.json({ error: 'کانال پیدا نشد' }, { status: 404 })
  }

  const [upcoming, published] = await Promise.all([
    db.publishJob.findMany({
      where: {
        workspaceId,
        platformId,
        status: { in: ['pending', 'scheduled', 'processing'] },
        scheduledAt: { not: null },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 24,
      include: { content: { select: { id: true, title: true, thumbnailUrl: true } } },
    }),
    db.publishJob.findMany({
      where: { workspaceId, platformId, status: { in: ['success', 'live'] } },
      orderBy: [{ completedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 12,
      include: { content: { select: { id: true, title: true, thumbnailUrl: true } } },
    }),
  ])

  const now = Date.now()
  const toItem = (
    j: (typeof upcoming)[number],
    kind: IgGridItem['kind']
  ): IgGridItem => ({
    jobId: j.id,
    contentId: j.contentId,
    title: j.content?.title ?? 'بدون عنوان',
    thumbnail: j.content?.thumbnailUrl ?? j.thumbnailUrl ?? '',
    kind,
    at: kind === 'scheduled'
      ? (j.scheduledAt?.toISOString() ?? null)
      : (j.completedAt?.toISOString() ?? null),
    // Reschedule validation rejects past dates, so overdue slots are fixed in place.
    reorderable:
      kind === 'scheduled' && !!j.scheduledAt && j.scheduledAt.getTime() > now + 60_000,
  })

  return NextResponse.json({
    items: [
      ...upcoming.map((j) => toItem(j, 'scheduled')),
      ...published.map((j) => toItem(j, 'published')),
    ],
  })
}

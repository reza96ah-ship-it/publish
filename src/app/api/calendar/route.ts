import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getWorkspaceId } from '@/lib/server'
import { jalaliToDate } from '@/lib/jalali'
import { validateParams, contentListQuerySchema } from '@/lib/validations'
import { z } from 'zod'

const calendarQuerySchema = z.object({
  year: z.coerce.number().int().min(1300).max(1500, "سال نامعتبر است"),
  month: z.coerce.number().int().min(1).max(12, "ماه نامعتبر است"),
})

export async function GET(req: Request) {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return NextResponse.json({ error: 'workspace not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const paramCheck = validateParams(calendarQuerySchema, {
    year: searchParams.get('year') ?? '',
    month: searchParams.get('month') ?? '',
  })
  if (!paramCheck.success) {
    return NextResponse.json({ error: paramCheck.error }, { status: 400 })
  }
  const { year, month } = paramCheck.data

  // Window: that Jalali month → gregorian range (start of month ± 5 days buffer
  // to catch jobs that fall on the boundary due to timezone offsets).
  const startGreg = jalaliToDate(year, month, 1)
  const endGreg = month < 12 ? jalaliToDate(year, month + 1, 1) : jalaliToDate(year + 1, 1, 1)
  startGreg.setDate(startGreg.getDate() - 5)
  endGreg.setDate(endGreg.getDate() + 5)

  const jobs = await db.publishJob.findMany({
    where: {
      workspaceId,
      scheduledAt: { gte: startGreg, lte: endGreg },
    },
    include: {
      content: { select: { title: true, thumbnailUrl: true } },
      platform: { select: { type: true } },
    },
  })

  return NextResponse.json(jobs.map((j) => ({
    id: j.id,
    title: j.content?.title ?? 'بدون عنوان',
    thumbnail: j.content?.thumbnailUrl ?? j.thumbnailUrl ?? '',
    platform: j.platform?.type ?? 'unknown',
    status: j.status,
    scheduledAt: j.scheduledAt,
    progress: j.progress,
  })))
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { jalaliToDate } from '@/lib/jalali'
import { validateParams, contentListQuerySchema } from '@/lib/validations'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const calendarQuerySchema = z.object({
  year: z.coerce.number().int().min(1300).max(1500, 'ط³ط§ظ„ ظ†ط§ظ…ط¹طھط¨ط± ط§ط³طھ'),
  month: z.coerce.number().int().min(1).max(12, 'ظ…ط§ظ‡ ظ†ط§ظ…ط¹طھط¨ط± ط§ط³طھ'),
})

export async function GET(req: Request) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const { searchParams } = new URL(req.url)
  const paramCheck = validateParams(calendarQuerySchema, {
    year: searchParams.get('year') ?? '',
    month: searchParams.get('month') ?? '',
  })
  if (!paramCheck.success) {
    return NextResponse.json({ error: paramCheck.error }, { status: 400 })
  }
  const { year, month } = paramCheck.data

  // Window: that Jalali month â†’ gregorian range (start of month آ± 5 days buffer
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

  return NextResponse.json(
    jobs.map((j) => ({
      id: j.id,
      title: j.content?.title ?? 'ط¨ط¯ظˆظ† ط¹ظ†ظˆط§ظ†',
      thumbnail: j.content?.thumbnailUrl ?? j.thumbnailUrl ?? '',
      platform: j.platform?.type ?? 'unknown',
      status: j.status,
      scheduledAt: j.scheduledAt,
      progress: j.progress,
    }))
  )
}

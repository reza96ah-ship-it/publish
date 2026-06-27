import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enqueuePublishJob } from '@/lib/queue'
import { randomUUID } from 'crypto'
import { validateBody, publishSchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

interface PublishRequest {
  title: string
  caption?: string
  hashtags?: string
  note?: string
  campaignId?: string
  mediaIds?: string[]
  platformTypes: string[] // e.g. ['instagram', 'telegram']
  platformCaptions?: Record<string, string>
  scheduleMode: 'now' | 'schedule' | 'queue'
  scheduleDate?: string // Jalali YYYY/MM/DD
  scheduleTime?: string // HH:MM
  mode?: 'publish' | 'review'
}

export async function POST(req: Request) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  // Fetch the authenticated user's name (fallback to workspace member or 'â€”')
  const session = await getServerSession(authOptions)
  const authorName = (session?.user as any)?.name
    || (await db.workspaceMember.findFirst({
         where: { userId: (session?.user as any)?.id },
         select: { name: true },
       }))?.name
    || 'â€”'

  let body
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'ط¨ط¯ظ†ظ‡ ط¯ط±ط®ظˆط§ط³طھ ظ†ط§ظ…ط¹طھط¨ط± ط§ط³طھ' }, { status: 400 })

  const validation = validateBody(publishSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  body = validation.data as PublishRequest

  const mode = body.mode ?? 'publish'

  if (mode === 'publish' && (!body.platformTypes || body.platformTypes.length === 0)) {
    return NextResponse.json({ error: 'ط­ط¯ط§ظ‚ظ„ غŒع© ظ¾ظ„طھظپط±ظ… ط¨ط§غŒط¯ ط§ظ†طھط®ط§ط¨ ط´ظˆط¯' }, { status: 400 })
  }

  // Resolve platforms for the selected types (one job per connected platform)
  const platforms = await db.platform.findMany({
    where: {
      workspaceId,
      type: { in: body.platformTypes },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (platforms.length === 0) {
    return NextResponse.json(
      { error: 'ظ‡غŒع† ظ¾ظ„طھظپط±ظ… ظ…طھطµظ„غŒ ط¨ط±ط§غŒ ظ¾ظ„طھظپط±ظ…â€Œظ‡ط§غŒ ط§ظ†طھط®ط§ط¨â€Œط´ط¯ظ‡ غŒط§ظپطھ ظ†ط´ط¯' },
      { status: 400 },
    )
  }

  // Resolve media
  const media = body.mediaIds && body.mediaIds.length > 0
    ? await db.media.findMany({ where: { id: { in: body.mediaIds }, workspaceId } })
    : []
  const thumbnailUrl = media[0]?.thumbnailUrl ?? media[0]?.url ?? null

  // Compute scheduled time (only for publish mode)
  const scheduledAt = mode === 'publish' ? computeScheduledAt(body) : null

  // Create content + platform links + publish jobs in a transaction
  const contentId = randomUUID()

  const result = await db.$transaction(async (tx) => {
    // 1. Create content â€” status depends on mode
    const content = await tx.content.create({
      data: {
        id: contentId,
        workspaceId,
        campaignId: body.campaignId || null,
        title: body.title.trim(),
        body: body.caption || null,
        hashtags: body.hashtags || null,
        internalNote: body.note || null,
        status: mode === 'review' ? 'review' : 'scheduled',
        thumbnailUrl,
        authorName,
        scheduledAt,
      },
    })

    // 2. Link platforms to content
    for (const p of platforms) {
      await tx.contentPlatform.create({
        data: {
          contentId: content.id,
          platformId: p.id,
        },
      })
    }

    // 3. Create a publish job per platform (only in publish mode â€” skip for review)
    const jobs: { id: string; platform: string; idempotencyKey: string }[] = []
    if (mode === 'publish') {
      for (const p of platforms) {
        const jobId = randomUUID()
        const idempotencyKey = randomUUID()
        const job = await tx.publishJob.create({
          data: {
            id: jobId,
            workspaceId,
            contentId: content.id,
            platformId: p.id,
            campaignId: body.campaignId || null,
            status: 'pending',
            progress: 0,
            processLabel: 'ط¯ط± ط§ظ†طھط¸ط§ط±',
            idempotencyKey,
            scheduledAt,
            thumbnailUrl,
          },
        })
        jobs.push({ id: job.id, platform: p.type, idempotencyKey: job.idempotencyKey })
      }
    }

    return { content, jobs }
  })

  // 3a. Enqueue BullMQ jobs for each created PublishJob (Sprint B #63)
  if (mode === 'publish' && result.jobs.length > 0) {
    for (const job of result.jobs) {
      try {
        await enqueuePublishJob({
          jobId: job.id,
          idempotencyKey: job.idempotencyKey,
          contentId: result.content.id,
          platformId: platforms.find(p => p.type === job.platform)?.id ?? '',
          workspaceId,
          scheduledAt: scheduledAt ?? null,
        })
      } catch (err) {
        // Non-fatal: if Redis is down, the DB record still exists.
        // The worker can be restarted to re-enqueue from DB if needed.
        console.error(`[publish] failed to enqueue BullMQ job ${job.id}:`, err)
      }
    }
  }

  // 4. Create a notification
  if (mode === 'review') {
    // Notify approvers that content needs review
    await db.notification.create({
      data: {
        workspaceId,
        type: 'approval_requested',
        title: 'ظ…ط­طھظˆط§غŒ ط¬ط¯غŒط¯ ط¨ط±ط§غŒ طھط£غŒغŒط¯',
        body: `آ«${body.title.trim()}آ» ط¨ط±ط§غŒ ط¨ط±ط±ط³غŒ ط§ط±ط³ط§ظ„ ط´ط¯`,
        isRead: false,
      },
    })
  } else {
    await db.notification.create({
      data: {
        workspaceId,
        type: 'publish_success',
        title: `ظ…ط­طھظˆط§غŒ آ«${body.title.trim()}آ» ط¨ط±ط§غŒ ط§ظ†طھط´ط§ط± ط¯ط± ${String(platforms.length)} ظ¾ظ„طھظپط±ظ… ط²ظ…ط§ظ†â€Œط¨ظ†ط¯غŒ ط´ط¯`,
        body: `ظ¾ظ„طھظپط±ظ…â€Œظ‡ط§: ${platforms.map((p) => p.name).join('طŒ ')}`,
        isRead: false,
      },
    })
  }

  return NextResponse.json({
    contentId: result.content.id,
    jobs: result.jobs,
    scheduledAt: scheduledAt?.toISOString() ?? null,
    message:
      mode === 'review'
        ? 'ظ…ط­طھظˆط§ ط¨ط±ط§غŒ طھط£غŒغŒط¯ ط§ط±ط³ط§ظ„ ط´ط¯'
        : body.scheduleMode === 'now'
          ? 'ظ…ط­طھظˆط§ ط¨ط±ط§غŒ ط§ظ†طھط´ط§ط± ط§ط±ط³ط§ظ„ ط´ط¯'
          : body.scheduleMode === 'schedule'
            ? 'ط²ظ…ط§ظ†â€Œط¨ظ†ط¯غŒ ط§ظ†طھط´ط§ط± ط«ط¨طھ ط´ط¯'
            : 'ظ…ط­طھظˆط§ ط¨ظ‡ طµظپ ط§ظ†طھط´ط§ط± ط§ظپط²ظˆط¯ظ‡ ط´ط¯',
  }, { status: 201 })
}

/**
 * Compute the scheduledAt timestamp from the schedule mode.
 * - "now": null (publish immediately â€” worker picks it up)
 * - "schedule": parse Jalali date + time â†’ Date
 * - "queue": null (worker processes in order)
 */
function computeScheduledAt(body: PublishRequest): Date | null {
  if (body.scheduleMode === 'schedule' && body.scheduleDate && body.scheduleTime) {
    const [jy, jm, jd] = body.scheduleDate.split('/').map(Number)
    if (jy && jm && jd) {
      const greg = jalaliToGregorian(jy, jm, jd)
      const [hh, mm] = body.scheduleTime.split(':').map(Number)
      return new Date(greg.year, greg.month - 1, greg.day, hh ?? 12, mm ?? 0, 0, 0)
    }
  }
  return null
}

/** Jalali â†’ Gregorian conversion (same algorithm as src/lib/jalali.ts) */
function jalaliToGregorian(jy: number, jm: number, jd: number): { year: number; month: number; day: number } {
  function div(a: number, b: number) { return Math.floor(a / b) }
  function mod(a: number, b: number) { return a - Math.floor(a / b) * b }

  const sal_a = jy <= 979 ? 0 : -1595
  const gy_a = jy <= 979 ? 621 + jy : 1600 + jy - 979
  const days_a = jy <= 979
    ? 365 * jy + div(8 + jy, 33) * 8 + div(mod(8 + jy, 33) + 3, 4) + sal_a
    : 365 * (jy - 979) + div(jy, 33) * 8 + div(mod(jy, 33) + 3, 4) + 1081
  let days_b = days_a + 179 + (jm <= 7 ? (jm - 1) * 31 : (jm - 1) * 30 + 186) + jd

  let gy = gy_a + 400 * div(days_b, 146097)
  days_b = mod(days_b, 146097)

  let leap = true
  if (days_b >= 36525) {
    days_b -= 1
    gy += 100 * div(days_b, 36524)
    days_b = mod(days_b, 36524)
    if (days_b < 365) leap = false
    days_b += 1
  }

  let n = 0
  if (leap) {
    gy += 4 * div(days_b, 1461)
    days_b = mod(days_b, 1461)
    if (days_b > 365) {
      days_b -= 1
      n = div(days_b, 365)
      gy += n
      days_b = mod(days_b, 365)
      n += 1
    }
  } else {
    n = div(days_b, 365)
    gy += n
    days_b = mod(days_b, 365)
    n += 1
  }

  const md = [31, (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm = 0
  let gd = 0
  for (let i = 0; i < md.length; i++) {
    if (days_b + 1 <= md[i]) {
      gm = i + 1
      gd = days_b + 1
      break
    }
    days_b -= md[i]
  }
  return { year: gy, month: gm, day: gd }
}

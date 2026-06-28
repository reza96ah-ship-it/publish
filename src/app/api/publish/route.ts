import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi, can } from '@/lib/auth-guards'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
  channelIds?: string[]
  platformCaptions?: Record<string, string>
  scheduleMode: 'now' | 'schedule' | 'queue'
  scheduledAt?: string | null
  mode?: 'publish' | 'review' | 'draft'
}

export async function POST(req: Request) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  // BUG-10: require content.publish permission
  if (guard.session && !can(guard.role, 'content.publish')) {
    return NextResponse.json({ error: 'دسترسی کافی برای انتشار ندارید' }, { status: 403 })
  }

  const session = await getServerSession(authOptions)
  const authorName =
    (session?.user as any)?.name ||
    (
      await db.workspaceMember.findFirst({
        where: { userId: (session?.user as any)?.id },
        select: { name: true },
      })
    )?.name ||
    '—'

  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })

  const validation = validateBody(publishSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const body = validation.data as PublishRequest

  const mode = body.mode ?? 'publish'

  if (mode === 'publish' && (!body.channelIds || body.channelIds.length === 0)) {
    return NextResponse.json({ error: 'حداقل یک کانال باید انتخاب شود' }, { status: 400 })
  }

  const channels =
    mode !== 'draft' && body.channelIds && body.channelIds.length > 0
      ? await db.platform.findMany({
          where: { workspaceId, id: { in: body.channelIds } },
          orderBy: { createdAt: 'asc' },
        })
      : []

  if (mode === 'publish' && channels.length === 0) {
    return NextResponse.json(
      { error: 'هیچ کانال متصلی برای شناسه‌های انتخاب‌شده یافت نشد' },
      { status: 400 }
    )
  }

  const media =
    body.mediaIds && body.mediaIds.length > 0
      ? await db.media.findMany({ where: { id: { in: body.mediaIds }, workspaceId } })
      : []
  const thumbnailUrl = media[0]?.thumbnailUrl ?? media[0]?.url ?? null

  const scheduledAt = mode === 'publish' ? computeScheduledAt(body) : null

  const contentId = randomUUID()

  // MISS-01: Content + PublishJobs + OutboxEvents in ONE transaction.
  // The outbox dispatcher in publish-worker polls OutboxEvent and enqueues to BullMQ.
  // This eliminates the DB+queue split — if Redis is down, events survive in Postgres
  // and are delivered once Redis comes back.
  const result = await db.$transaction(async (tx) => {
    const content = await tx.content.create({
      data: {
        id: contentId,
        workspaceId,
        campaignId: body.campaignId || null,
        title: body.title.trim(),
        body: body.caption || null,
        hashtags: body.hashtags || null,
        internalNote: body.note || null,
        status: mode === 'review' ? 'review' : mode === 'draft' ? 'draft' : 'scheduled',
        thumbnailUrl,
        authorName,
        scheduledAt,
      },
    })

    for (const p of channels) {
      await tx.contentPlatform.create({
        data: { contentId: content.id, platformId: p.id },
      })
    }

    const jobs: { id: string; platform: string; idempotencyKey: string }[] = []
    if (mode === 'publish') {
      for (const p of channels) {
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
            processLabel: 'در انتظار',
            idempotencyKey,
            scheduledAt,
            thumbnailUrl,
          },
        })
        jobs.push({ id: job.id, platform: p.type, idempotencyKey: job.idempotencyKey })

        // MISS-01: write OutboxEvent in the same transaction — guarantees delivery
        await tx.outboxEvent.create({
          data: {
            workspaceId,
            aggregateType: 'content',
            aggregateId: content.id,
            eventType: 'publish_requested',
            payload: {
              jobId: job.id,
              contentId: content.id,
              platformId: p.id,
              workspaceId,
              scheduledAt: scheduledAt?.toISOString() ?? null,
              idempotencyKey: job.idempotencyKey,
            },
            availableAt: scheduledAt ?? new Date(),
          },
        })
      }
    }

    return { content, jobs }
  })

  if (mode === 'review') {
    await db.notification.create({
      data: {
        workspaceId,
        type: 'approval_requested',
        title: 'محتوای جدید برای تأیید',
        body: `«${body.title.trim()}» برای بررسی ارسال شد`,
        isRead: false,
      },
    })
  } else if (mode === 'publish') {
    await db.notification.create({
      data: {
        workspaceId,
        type: 'publish_queued',
        title: `محتوای «${body.title.trim()}» برای انتشار در ${String(channels.length)} کانال زمان‌بندی شد`,
        body: `کانال‌ها: ${channels.map((p) => p.name).join('، ')}`,
        isRead: false,
      },
    })
  }

  const message =
    mode === 'review'
      ? 'محتوا برای تأیید ارسال شد'
      : mode === 'draft'
        ? 'پیش‌نویس ذخیره شد'
        : body.scheduleMode === 'now'
          ? 'محتوا به صف انتشار ارسال شد'
          : body.scheduleMode === 'schedule'
            ? 'زمان‌بندی انتشار ثبت شد'
            : 'محتوا به صف انتشار افزوده شد'

  return NextResponse.json(
    {
      contentId: result.content.id,
      jobs: result.jobs,
      scheduledAt: scheduledAt?.toISOString() ?? null,
      message,
    },
    { status: 201 }
  )
}

function computeScheduledAt(body: PublishRequest): Date | null {
  if (body.scheduleMode === 'schedule' && body.scheduledAt) {
    const d = new Date(body.scheduledAt)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * MISS-04: Durable compose-view draft persistence.
 *
 * POST /api/compose-draft — upsert the user's active draft (one per user per workspace).
 * GET  /api/compose-draft — fetch the current draft to restore on page load.
 *
 * The compose view debounces changes (3s) and calls POST to autosave.
 * On success the response includes id, version, savedAt so the UI can
 * show an accurate "Saved" indicator.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const session = await getServerSession(authOptions)
  const authorId = session?.user?.id
  if (!authorId) return NextResponse.json({ draft: null })

  const draft = await db.contentDraft.findUnique({
    where: { workspaceId_authorId: { workspaceId, authorId } },
  })

  return NextResponse.json({ draft })
}

export async function POST(req: Request) {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const session = await getServerSession(authOptions)
  const authorId = session?.user?.id
  if (!authorId) {
    return NextResponse.json({ error: 'شناسه کاربر یافت نشد' }, { status: 401 })
  }

  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const { content, channelIds, scheduledAt, version } = raw as {
    content: Record<string, unknown>
    channelIds: string[]
    scheduledAt: string | null
    version?: number
  }

  if (!content || typeof content !== 'object') {
    return NextResponse.json({ error: 'فیلد content الزامی است' }, { status: 400 })
  }

  const existing = await db.contentDraft.findUnique({
    where: { workspaceId_authorId: { workspaceId, authorId } },
    select: { version: true },
  })

  // Issue #152: Optimistic concurrency check
  if (existing && typeof version === 'number' && version < existing.version) {
    return NextResponse.json(
      {
        error: 'conflict',
        message: 'پیش‌نویس توسط پنجره دیگری ویرایش شده است.',
        version: existing.version,
      },
      { status: 409 }
    )
  }

  // Prisma's Json type requires casting via Prisma.InputJsonValue
  const contentJson = content as Parameters<typeof db.contentDraft.create>[0]['data']['content']

  const draft = await db.contentDraft.upsert({
    where: { workspaceId_authorId: { workspaceId, authorId } },
    create: {
      workspaceId,
      authorId,
      content: contentJson,
      channelIds: channelIds ?? [],
      scheduledAt: scheduledAt ?? null,
      version: 1,
    },
    update: {
      content: contentJson,
      channelIds: channelIds ?? [],
      scheduledAt: scheduledAt ?? null,
      version: (existing?.version ?? 0) + 1,
    },
  })

  return NextResponse.json({
    id: draft.id,
    version: draft.version,
    savedAt: draft.updatedAt,
  })
}

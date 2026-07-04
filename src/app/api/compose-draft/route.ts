/**
 * Compose draft persistence — GET fetches, POST upserts with optimistic concurrency.
 */
import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error
  const session = await getServerSession(authOptions)
  const authorId = session?.user?.id
  if (!authorId) return NextResponse.json({ draft: null })
  const draft = await db.contentDraft.findUnique({ where: { workspaceId_authorId: { workspaceId: guard.workspaceId, authorId } } })
  return NextResponse.json({ draft })
}

export async function POST(req: Request) {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error
  const session = await getServerSession(authOptions)
  const authorId = session?.user?.id
  if (!authorId) return NextResponse.json({ error: 'شناسه کاربر یافت نشد' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })
  const { content, channelIds, scheduledAt, version } = raw as { content: Record<string, unknown>; channelIds: string[]; scheduledAt: string | null; version?: number }
  if (!content || typeof content !== 'object') return NextResponse.json({ error: 'فیلد content الزامی است' }, { status: 400 })

  const existing = await db.contentDraft.findUnique({ where: { workspaceId_authorId: { workspaceId: guard.workspaceId, authorId } }, select: { version: true } })
  if (existing && typeof version === 'number' && version < existing.version)
    return NextResponse.json({ error: 'conflict', message: 'پیش‌نویس توسط پنجره دیگری ویرایش شده است.', version: existing.version }, { status: 409 })

  const contentJson = content as Parameters<typeof db.contentDraft.create>[0]['data']['content']
  const draft = await db.contentDraft.upsert({
    where: { workspaceId_authorId: { workspaceId: guard.workspaceId, authorId } },
    create: { workspaceId: guard.workspaceId, authorId, content: contentJson, channelIds: channelIds ?? [], scheduledAt: scheduledAt ?? null, version: 1 },
    update: { content: contentJson, channelIds: channelIds ?? [], scheduledAt: scheduledAt ?? null, version: (existing?.version ?? 0) + 1 },
  })
  return NextResponse.json({ id: draft.id, version: draft.version, savedAt: draft.updatedAt })
}

/**
 * Compose draft persistence — GET fetches, POST upserts with optimistic concurrency.
 */
import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { validateBody, composeDraftSchema } from '@/lib/validations'

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
  const validation = validateBody(composeDraftSchema, raw)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
  const { content, channelIds, scheduledAt, version } = validation.data

  const contentJson = content as Parameters<typeof db.contentDraft.create>[0]['data']['content']
  const key = { workspaceId: guard.workspaceId, authorId }
  const changes = { content: contentJson, channelIds, scheduledAt: scheduledAt ?? null }
  let draft
  try {
    draft = version == null
      ? await db.contentDraft.create({ data: { ...key, ...changes, version: 1 } })
      : await db.contentDraft.update({
          where: { workspaceId_authorId: key, version },
          data: { ...changes, version: { increment: 1 } },
        })
  } catch (error) {
    // Unique-create and stale-version races both mean another tab saved first.
    const expectedCode = version == null ? 'P2002' : 'P2025'
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== expectedCode) throw error
    const latest = await db.contentDraft.findUnique({ where: { workspaceId_authorId: key }, select: { version: true } })
    return NextResponse.json({ error: 'conflict', message: 'پیش‌نویس توسط پنجره دیگری ویرایش شده است.', version: latest?.version ?? null }, { status: 409 })
  }
  return NextResponse.json({ id: draft.id, version: draft.version, savedAt: draft.updatedAt })
}

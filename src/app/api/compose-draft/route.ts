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

const MAX_DRAFT_MEDIA = 20

function mediaIdsFromContent(content: unknown): string[] {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return []
  const ids = (content as Record<string, unknown>).mediaIds
  if (!Array.isArray(ids)) return []
  return ids.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100).slice(0, MAX_DRAFT_MEDIA)
}

export async function GET(req: Request) {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error
  const session = await getServerSession(authOptions)
  const authorId = session?.user?.id
  if (!authorId) return NextResponse.json({ draft: null, media: [] }, { headers: { 'Cache-Control': 'no-store' } })

  // Local-only drafts can supply their IDs for workspace-scoped resolution.
  const requestedIds = new URL(req.url).searchParams.getAll('mediaId')
  if (requestedIds.length > MAX_DRAFT_MEDIA || requestedIds.some((id) => !id || id.length > 100))
    return NextResponse.json({ error: 'شناسه رسانه نامعتبر است' }, { status: 400 })

  const draft = await db.contentDraft.findUnique({ where: { workspaceId_authorId: { workspaceId: guard.workspaceId, authorId } } })
  const ids = [...new Set([...mediaIdsFromContent(draft?.content), ...requestedIds])]
  const media = ids.length ? await db.media.findMany({
    where: { workspaceId: guard.workspaceId, status: 'validated', id: { in: ids } },
    select: { id: true, name: true, thumbnailUrl: true, url: true, fileType: true, fileSize: true },
  }) : []
  const byId = new Map(media.map((item) => [item.id, item]))
  return NextResponse.json({
    draft,
    media: ids.flatMap((id) => {
      const item = byId.get(id)
      return item ? [{ id: item.id, name: item.name, thumbnail: item.thumbnailUrl ?? item.url, fileType: item.fileType, fileSize: item.fileSize }] : []
    }),
  }, { headers: { 'Cache-Control': 'no-store' } })
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

  const rawMediaIds = content.mediaIds
  if (rawMediaIds !== undefined && (
    !Array.isArray(rawMediaIds) || rawMediaIds.length > MAX_DRAFT_MEDIA ||
    rawMediaIds.some((id) => typeof id !== 'string' || !id || id.length > 100) ||
    new Set(rawMediaIds).size !== rawMediaIds.length
  )) return NextResponse.json({ error: 'شناسه رسانه نامعتبر است' }, { status: 400 })
  const mediaIds = rawMediaIds as string[] | undefined
  if (mediaIds?.length) {
    const validated = await db.media.findMany({
      where: { workspaceId: guard.workspaceId, status: 'validated', id: { in: mediaIds } },
      select: { id: true },
    })
    if (validated.length !== mediaIds.length)
      return NextResponse.json({ error: 'رسانه انتخاب‌شده در این فضای کاری موجود نیست یا آماده نیست' }, { status: 400 })
  }

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

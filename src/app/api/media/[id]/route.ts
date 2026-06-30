/**
 * DELETE /api/media/[id] — remove a validated media asset. (Issue #146)
 *
 * Idempotent and retryable: deleting an already-deleted asset returns ok.
 * Refuses to delete an asset that is still referenced by a publication that
 * hasn't reached a terminal state — the publication must be updated or
 * cancelled first.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { deleteObject, buildDerivedKey } from '@/lib/storage'

export const dynamic = 'force-dynamic'

const ACTIVE_PUBLICATION_STATUSES = ['pending', 'processing', 'action', 'scheduled']

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requirePermissionApi('media.delete')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const media = await db.media.findFirst({ where: { id, workspaceId } })
  if (!media) return NextResponse.json({ error: 'رسانه یافت نشد' }, { status: 404 })

  if (media.status === 'deleted') {
    return NextResponse.json({ ok: true })
  }

  // Block deletion of an asset an active (non-terminal) publication still depends on
  const referencingRevisions = await db.revisionMedia.findMany({
    where: { mediaId: id },
    select: { revisionId: true },
  })
  if (referencingRevisions.length > 0) {
    const activePublication = await db.publication.findFirst({
      where: {
        revisionId: { in: referencingRevisions.map((r) => r.revisionId) },
        status: { in: ACTIVE_PUBLICATION_STATUSES },
      },
    })
    if (activePublication) {
      return NextResponse.json(
        {
          error:
            'این رسانه در یک انتشار فعال استفاده شده است. ابتدا انتشار را لغو یا ویرایش کنید',
        },
        { status: 409 }
      )
    }
  }

  await db.media.update({ where: { id }, data: { status: 'deleting' } })

  await deleteObject(media.storageKey)
  if (media.thumbnailUrl && media.thumbnailUrl !== media.url) {
    await deleteObject(buildDerivedKey(media.storageKey, 'thumb.webp'))
  }

  await db.media.update({ where: { id }, data: { status: 'deleted' } })

  return NextResponse.json({ ok: true })
}

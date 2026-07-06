/**
 * Issue #210: Media library search + folder management API.
 *   GET  /api/media/search?q=&folder=&tag=
 *   POST /api/media/search  body: { action: 'renameFolder'|'deleteFolder'|'patchMedia', ... }
 * Permission: media.upload / content.review.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAnyPermissionApi } from '@/lib/auth-guards'
import { validateBody, persianText } from '@/lib/validations'
import { mediaService, MediaError } from '@/modules/media'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof MediaError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function GET(req: NextRequest) {
  const guard = await requireAnyPermissionApi(['media.upload', 'content.review'])
  if (guard.error) return guard.error
  const sp = req.nextUrl.searchParams
  try {
    const result = await mediaService.searchMedia(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      {
        search: sp.get('q') ?? undefined,
        folder: sp.get('folder') ?? undefined,
        tag: sp.get('tag') ?? undefined,
      }
    )
    return NextResponse.json(result)
  } catch (err) { return mapError(err) }
}

const folderActionSchema = z.object({
  action: z.enum(['renameFolder', 'deleteFolder', 'patchMedia']),
  oldName: persianText(0, 100).optional(),
  newName: persianText(0, 100).optional(),
  folder: persianText(0, 100).optional(),
  mediaId: z.string().max(100).optional(),
  tags: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const guard = await requireAnyPermissionApi(['media.upload', 'content.review'])
  if (guard.error) return guard.error
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(folderActionSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  const auth = { workspaceId: guard.workspaceId, userId: guard.userId }
  try {
    if (v.data.action === 'renameFolder') {
      if (!v.data.oldName || !v.data.newName) {
        return NextResponse.json({ error: 'نام پوشه قدیم و جدید الزامی است' }, { status: 400 })
      }
      return NextResponse.json(await mediaService.renameFolder(auth, v.data.oldName, v.data.newName))
    }
    if (v.data.action === 'deleteFolder') {
      if (!v.data.folder) return NextResponse.json({ error: 'نام پوشه الزامی است' }, { status: 400 })
      return NextResponse.json(await mediaService.deleteFolder(auth, v.data.folder))
    }
    if (!v.data.mediaId) return NextResponse.json({ error: 'شناسه رسانه الزامی است' }, { status: 400 })
    const patch: { folder?: string; tags?: string } = {}
    if (v.data.folder !== undefined) patch.folder = v.data.folder
    if (v.data.tags !== undefined) patch.tags = v.data.tags
    const updated = await mediaService.patchMedia(auth, v.data.mediaId, patch)
    if (!updated) return NextResponse.json({ error: 'رسانه یافت نشد' }, { status: 404 })
    return NextResponse.json({ media: updated })
  } catch (err) { return mapError(err) }
}

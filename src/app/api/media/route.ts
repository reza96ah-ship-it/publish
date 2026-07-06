/**
 * GET /api/media — cursor-paginated list of validated media for the library. (Issue #146, #156)
 *
 * Thin transport handler: auth → validate query → service.list() → map.
 *
 * The service (src/modules/media/service.ts) owns the listing policy:
 *   only validated assets are returned; pending/rejected/deleting are never
 *   listed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermissionApi } from '@/lib/auth-guards'
import { validateParams, cursorPaginationSchema } from '@/lib/validations'
import { mediaService } from '@/modules/media'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Approvers reviewing content need to see attached media (content.review)
  const guard = await requireAnyPermissionApi(['media.upload', 'content.review'])
  if (guard.error) return guard.error

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  const { cursor, limit } = queryCheck.data

  const result = await mediaService.list(
    { workspaceId: guard.workspaceId, userId: guard.userId },
    { cursor, limit }
  )

  return NextResponse.json({
    data: result.data.map((m) => ({
      id: m.id,
      name: m.name,
      fileType: m.fileType,
      fileSize: m.fileSize,
      url: m.url,
      thumbnail: m.thumbnail,
      // Issue #210: surface folder + tags + createdAt from the service payload
      // (previously stubbed as 'default' / [] / null — now real).
      folder: m.folder ?? 'عمومی',
      tags: m.tags ?? [],
      width: m.width,
      height: m.height,
      createdAt: m.createdAt ?? null,
    })),
    nextCursor: result.nextCursor,
  })
}

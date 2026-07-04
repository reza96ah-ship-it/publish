/**
 * PUT /api/media/local-upload?key=... — dev-only upload transport. (Issue #146)
 *
 * Mirrors what an S3 presigned PUT would do: streams the body straight to disk
 * while hashing on the fly. The key must match a pending Media row created by
 * /api/media/presign for this workspace. Production must use S3.
 *
 * Issue #200: thin handler. Streaming, hashing, and Media row state transitions
 * live in src/modules/media/service.ts (MediaService.localUpload).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { mediaService, MediaError } from '@/modules/media'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PUT(req: NextRequest) {
  const guard = await requirePermissionApi('media.upload')
  if (guard.error) return guard.error

  const key = req.nextUrl.searchParams.get('key') ?? ''
  const contentLength = Number(req.headers.get('content-length') ?? '0')

  try {
    await mediaService.localUpload(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      key,
      req.body,
      contentLength,
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof MediaError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}

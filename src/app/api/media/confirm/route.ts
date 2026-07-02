/**
 * POST /api/media/confirm — validate the uploaded object + finalize the Media record. (Issue #146, #156)
 *
 * Thin transport handler: auth → validate → service.confirm() → map.
 *
 * The service (src/modules/media/service.ts) owns all validation logic:
 *   tenant scoping, expiry, checksum, magic bytes, image pixel/dimension
 *   guards, sharp thumbnail generation, ffprobe video probe, idempotent
 *   re-confirm, and atomic reject+delete on any failure.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody } from '@/lib/validations'
import { z } from 'zod'
import { mediaService, MediaError } from '@/modules/media'

export const dynamic = 'force-dynamic'

const confirmSchema = z.object({
  mediaId: z.string().min(1, 'شناسه رسانه الزامی است'),
})

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('media.upload')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(confirmSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })

  try {
    const result = await mediaService.confirm(
      { workspaceId, userId: guard.userId },
      validation.data
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof MediaError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}

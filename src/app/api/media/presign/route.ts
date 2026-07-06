/**
 * POST /api/media/presign — get a presigned URL for direct-to-storage upload. (Issue #146, #156)
 *
 * Thin transport handler: auth → rate-limit → validate → service.presign() → map.
 *
 * Request: { fileName: string, fileType: string, fileSize: number }
 * Response: { uploadUrl, key, mediaId }
 *
 * The service (src/modules/media/service.ts) owns all business logic:
 *   type whitelist, per-type size limit, concurrent-pending cap, workspace
 *   quota check, server-owned storage key, pending Media row creation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody } from '@/lib/validations'
import { z } from 'zod'
import { rateLimit } from '@/lib/ratelimit'
import { mediaService, MediaError } from '@/modules/media'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const

const MAX_VIDEO_BYTES = 200 * 1024 * 1024 // 200MB — mirror of service constant for the schema

const presignSchema = z.object({
  fileName: z.string().min(1, 'نام فایل الزامی است').max(200, 'نام فایل خیلی طولانی است'),
  fileType: z.enum(ALLOWED_TYPES, {
    message: 'فرمت فایل پشتیبانی نمی‌شود. فقط JPEG, PNG, WebP, GIF, MP4, MOV یا WebM مجاز است',
  }),
  fileSize: z.number().int().positive().max(MAX_VIDEO_BYTES, 'حجم فایل بیش از حد مجاز است'),
})

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('media.upload')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const rl = await rateLimit(`media-presign:${guard.userId}`, { limit: 20, window: 60 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'تعداد درخواست‌های آپلود زیاد است. کمی بعد دوباره تلاش کنید' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(presignSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })

  try {
    const result = await mediaService.presign(
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

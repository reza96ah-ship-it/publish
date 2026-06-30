/**
 * POST /api/media/presign — get a presigned URL for direct-to-storage upload. (Issue #146)
 *
 * Request: { fileName: string, fileType: string, fileSize: number }
 * Response: { uploadUrl, key, mediaId }
 *
 * The client then PUTs the file to uploadUrl (S3 in production, or
 * /api/media/local-upload in dev). This only creates a short-lived "pending"
 * Media row — it is not visible in the library and cannot be published until
 * POST /api/media/confirm validates the real uploaded bytes.
 *
 * Per-workspace storage quota is checked before issuing the presigned URL,
 * counting only already-validated assets (pending uploads don't count against
 * quota, but are capped separately to bound abandoned-upload growth).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody } from '@/lib/validations'
import { z } from 'zod'
import { createPresignedUpload, buildStorageKey, isS3Configured } from '@/lib/storage'
import { rateLimit } from '@/lib/ratelimit'

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

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024 // 200MB

const presignSchema = z.object({
  fileName: z.string().min(1, 'نام فایل الزامی است').max(200, 'نام فایل خیلی طولانی است'),
  fileType: z.enum(ALLOWED_TYPES, {
    message: 'فرمت فایل پشتیبانی نمی‌شود. فقط JPEG, PNG, WebP, GIF, MP4, MOV یا WebM مجاز است',
  }),
  fileSize: z.number().int().positive().max(MAX_VIDEO_BYTES, 'حجم فایل بیش از حد مجاز است'),
})

const STORAGE_QUOTA_BYTES = 500 * 1024 * 1024 // 500MB per workspace (validated assets only)
const MAX_CONCURRENT_PENDING = 20 // per workspace — bounds abandoned-upload growth
const PENDING_UPLOAD_TTL_MS = 15 * 60 * 1000 // 15 minutes

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
  const { fileName, fileType, fileSize } = validation.data

  const isVideo = fileType.startsWith('video/')
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (fileSize > maxBytes) {
    return NextResponse.json(
      {
        error: isVideo
          ? 'حداکثر حجم ویدیو ۲۰۰ مگابایت است'
          : 'حداکثر حجم تصویر ۱۰ مگابایت است',
      },
      { status: 400 }
    )
  }

  // Bound concurrent abandoned/in-flight uploads per workspace
  const pendingCount = await db.media.count({
    where: { workspaceId, status: { in: ['pending', 'uploaded', 'validating'] } },
  })
  if (pendingCount >= MAX_CONCURRENT_PENDING) {
    return NextResponse.json(
      { error: 'تعداد آپلودهای در حال انجام زیاد است. کمی صبر کنید و دوباره تلاش کنید' },
      { status: 429 }
    )
  }

  // Quota counts only validated assets — pending uploads don't consume it
  const existingMedia = await db.media.aggregate({
    where: { workspaceId, status: 'validated' },
    _sum: { fileSize: true },
  })
  const usedBytes = existingMedia._sum.fileSize ?? 0
  if (usedBytes + fileSize > STORAGE_QUOTA_BYTES) {
    const remaining = Math.max(0, STORAGE_QUOTA_BYTES - usedBytes)
    return NextResponse.json(
      {
        error: `سقف ذخیره‌سازی تکمیل است. فضای باقیمانده: ${Math.round(remaining / 1024 / 1024)} مگابایت`,
      },
      { status: 413 }
    )
  }

  // Server-owned, unpredictable key under the workspace prefix — never client-supplied
  const key = buildStorageKey(workspaceId, fileType)
  const { uploadUrl } = await createPresignedUpload({ key, fileType })

  const expiresAt = new Date(Date.now() + PENDING_UPLOAD_TTL_MS)

  const media = await db.media.create({
    data: {
      workspaceId,
      uploaderId: guard.userId,
      name: fileName,
      fileType,
      fileSize,
      declaredType: fileType,
      storageKey: key,
      storageProvider: isS3Configured ? 's3' : 'local',
      status: 'pending',
      url: '',
      folder: 'default',
      tags: '',
      expiresAt,
    },
  })

  return NextResponse.json({
    uploadUrl,
    key,
    mediaId: media.id,
  })
}

/**
 * POST /api/media/presign — get a presigned URL for direct-to-S3 upload.
 *
 * Request: { fileName: string, fileType: string, fileSize: number }
 * Response: { uploadUrl, key, publicUrl, mediaId }
 *
 * The client then PUTs the file directly to uploadUrl (bypasses Next.js body limit).
 * After upload, client calls POST /api/media/confirm to validate + create the Media record.
 *
 * Per-workspace storage quota is checked before issuing the presigned URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import { validateBody } from '@/lib/validations'
import { z } from 'zod'
import { createPresignedUpload } from '@/lib/storage'
import { randomUUID } from 'crypto'

const presignSchema = z.object({
  fileName: z.string().min(1, 'نام فایل الزامی است').max(200, 'نام فایل خیلی طولانی است'),
  fileType: z.string().regex(/^image\/(jpeg|png|webp|gif)$/, 'فرمت فایل باید jpeg, png, webp یا gif باشد'),
  fileSize: z.number().int().positive().max(10_485_760, 'حداکثر حجم فایل ۱۰ مگابایت است'), // 10MB
})

const STORAGE_QUOTA_BYTES = 500 * 1024 * 1024 // 500MB per workspace

export async function POST(req: NextRequest) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(presignSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
  const { fileName, fileType, fileSize } = validation.data

  // P9.3: Check per-workspace storage quota
  const existingMedia = await db.media.aggregate({
    where: { workspaceId },
    _sum: { fileSize: true },
  })
  const usedBytes = existingMedia._sum.fileSize ?? 0
  if (usedBytes + fileSize > STORAGE_QUOTA_BYTES) {
    const remaining = Math.max(0, STORAGE_QUOTA_BYTES - usedBytes)
    return NextResponse.json({
      error: `سقف ذخیره‌سازی تکمیل است. فضای باقیمانده: ${Math.round(remaining / 1024 / 1024)} مگابایت`,
    }, { status: 413 })
  }

  // Generate presigned URL
  const { uploadUrl, key, publicUrl } = await createPresignedUpload({
    fileName,
    fileType,
    workspaceId,
  })

  // Pre-create the Media record (status = 'pending' until confirm)
  const mediaId = randomUUID()
  await db.media.create({
    data: {
      id: mediaId,
      workspaceId,
      name: fileName,
      fileType,
      fileSize,
      url: publicUrl,
      thumbnailUrl: publicUrl, // will be updated on confirm
      folder: 'default',
      tags: '',
    },
  })

  return NextResponse.json({
    uploadUrl,
    key,
    publicUrl,
    mediaId,
  })
}

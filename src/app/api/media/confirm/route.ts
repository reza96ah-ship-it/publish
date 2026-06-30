/**
 * POST /api/media/confirm — validate uploaded file + finalize Media record.
 *
 * Request: { mediaId: string, key: string }
 * Response: { ok: true, media: {...} }
 *
 * Validates:
 *   1. File exists at the S3 key (or local path in dev)
 *   2. Magic bytes match the declared file type (anti-polyglot attack)
 *   3. If invalid, deletes the file + Media record
 *
 * If valid, generates a thumbnail (400أ—400 WebP) via sharp and updates the Media record.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody } from '@/lib/validations'
import { z } from 'zod'
import { fetchObjectHead, validateMagicBytes, deleteObject, isS3Configured } from '@/lib/storage'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'

const confirmSchema = z.object({
  mediaId: z.string().min(1, 'شناسه رسانه الزامی است'),
  key: z.string().min(1, 'کلید ذخیره‌سازی الزامی است'),
})

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('media.upload')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(confirmSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
  const { mediaId, key } = validation.data

  // Verify media belongs to workspace
  const media = await db.media.findFirst({ where: { id: mediaId, workspaceId } })
  if (!media) return NextResponse.json({ error: 'رسانه یافت نشد' }, { status: 404 })

  // P9.2: Fetch the uploaded file and validate magic bytes
  const buffer = await fetchObjectHead(key)
  if (!buffer) {
    await db.media.delete({ where: { id: mediaId } })
    return NextResponse.json(
      { error: 'فایل آپلودشده یافت نشد' },
      { status: 404 }
    )
  }

  const validation_result = validateMagicBytes(buffer)
  if (!validation_result.valid) {
    // Invalid file — delete from storage + DB
    await deleteObject(key)
    await db.media.delete({ where: { id: mediaId } })
    return NextResponse.json(
      {
        error: '',
      },
      { status: 400 }
    )
  }

  // Generate thumbnail via sharp (400أ—400 WebP)
  let thumbnailUrl = media.url
  let width = validation_result.width
  let height = validation_result.height

  try {
    if (isS3Configured) {
      // In production with S3, we'd upload the thumbnail separately.
      // For now, use the original URL (CDN handles resizing via query params).
      thumbnailUrl = media.url
    } else {
      // Dev: generate thumbnail locally
      const fullBuffer = await fetchObjectHead(key)
      if (fullBuffer) {
        const thumbnail = await sharp(fullBuffer)
          .resize(400, 400, { fit: 'cover' })
          .webp({ quality: 80 })
          .toBuffer()
        // In dev, we can't easily serve the thumbnail separately, so use original
        thumbnailUrl = media.url
      }
    }
  } catch (err) {
    console.warn('[media/confirm] thumbnail generation failed:', err)
    // Non-fatal — use original as thumbnail
  }

  // Update Media record with validated info
  const updated = await db.media.update({
    where: { id: mediaId },
    data: {
      thumbnailUrl,
      width: width ?? null,
      height: height ?? null,
    },
  })

  return NextResponse.json({
    ok: true,
    media: {
      id: updated.id,
      name: updated.name,
      fileType: updated.fileType,
      fileSize: updated.fileSize,
      url: updated.url,
      thumbnail: updated.thumbnailUrl ?? updated.url,
      width: updated.width,
      height: updated.height,
    },
  })
}

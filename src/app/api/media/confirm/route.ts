/**
 * POST /api/media/confirm — validate the uploaded object + finalize the Media record. (Issue #146)
 *
 * Request: { mediaId: string }  — the storage key is NEVER trusted from the
 * client; it is always read from the server-side "pending"/"uploaded" Media row.
 *
 * Validates:
 *   1. The row belongs to this workspace and hasn't expired.
 *   2. The object exists in storage and its real bytes match the checksum
 *      recorded during upload (defense in depth against TOCTOU swaps).
 *   3. Magic bytes match a supported format (anti-polyglot — filename/declared
 *      content-type is never trusted).
 *   4. The detected kind (image/video) matches what was declared at presign time.
 *   5. Images: safe pixel-count decode limit; dimensions extracted from real pixels.
 *
 * On any failure: the stored object is deleted and the row is marked
 * "rejected" with a safe reason (not deleted — keeps an audit trail).
 * On success: status becomes "validated" and a derived thumbnail is generated
 * (images: sharp resize; videos: ffprobe duration/codec + ffmpeg frame grab,
 * see src/lib/video-probe.ts).
 * Idempotent — re-confirming an already-validated row returns the same result.
 *
 * Storage note: both the local-disk and S3 code paths in src/lib/storage.ts
 * are implemented, but only the local-disk path has been live-tested in this
 * environment (no S3 credentials available here). The S3 path is unverified
 * live — treat it as implemented-but-unconfirmed until tested against a real
 * bucket.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody } from '@/lib/validations'
import { z } from 'zod'
import {
  fetchObject,
  deleteObject,
  validateMagicBytes,
  sha256,
  buildDerivedKey,
  putObject,
  publicUrlFor,
} from '@/lib/storage'
import { probeVideo } from '@/lib/video-probe'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'

const confirmSchema = z.object({
  mediaId: z.string().min(1, 'شناسه رسانه الزامی است'),
})

// Decompression-bomb guard: refuse to decode images with an absurd pixel count
// or any single dimension beyond a sane ceiling.
const MAX_IMAGE_PIXELS = 40_000_000 // ~40MP (e.g. 8000x5000)
const MAX_IMAGE_DIMENSION = 8000

function toMediaPayload(m: {
  id: string
  name: string
  fileType: string
  fileSize: number
  url: string
  thumbnailUrl: string | null
  width: number | null
  height: number | null
  durationMs?: number | null
  codec?: string | null
}) {
  return {
    id: m.id,
    name: m.name,
    fileType: m.fileType,
    fileSize: m.fileSize,
    url: m.url,
    thumbnail: m.thumbnailUrl ?? m.url,
    width: m.width,
    height: m.height,
    durationMs: m.durationMs ?? null,
    codec: m.codec ?? null,
  }
}

async function reject(mediaId: string, key: string, reason: string, message: string, status = 400) {
  await deleteObject(key)
  await db.media.update({
    where: { id: mediaId },
    data: { status: 'rejected', rejectedReason: reason },
  })
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('media.upload')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(confirmSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
  const { mediaId } = validation.data

  // Object-level tenant auth — never trust a client-supplied key
  const media = await db.media.findFirst({ where: { id: mediaId, workspaceId } })
  if (!media) return NextResponse.json({ error: 'رسانه یافت نشد' }, { status: 404 })

  // Idempotent: re-confirming an already-validated asset just returns the same result
  if (media.status === 'validated') {
    return NextResponse.json({ ok: true, media: toMediaPayload(media) })
  }

  if (media.status === 'rejected') {
    return NextResponse.json(
      { error: 'این فایل قبلاً رد شده است. لطفاً دوباره آپلود کنید' },
      { status: 400 }
    )
  }

  if (media.status !== 'uploaded') {
    return NextResponse.json(
      { error: 'فایل هنوز آپلود نشده است' },
      { status: 400 }
    )
  }

  if (media.expiresAt && media.expiresAt < new Date()) {
    return reject(media.id, media.storageKey, 'expired', 'مهلت آپلود منقضی شده است', 410)
  }

  await db.media.update({ where: { id: media.id }, data: { status: 'validating' } })

  const buffer = await fetchObject(media.storageKey)
  if (!buffer) {
    return reject(media.id, media.storageKey, 'object_missing', 'فایل آپلودشده یافت نشد', 404)
  }

  // Defense in depth: the bytes we validate must match what was hashed during upload
  if (media.checksumValue && sha256(buffer) !== media.checksumValue) {
    return reject(media.id, media.storageKey, 'checksum_mismatch', 'فایل آپلودشده دستکاری شده است', 400)
  }
  if (media.actualSize != null && buffer.length !== media.actualSize) {
    return reject(media.id, media.storageKey, 'size_mismatch', 'حجم فایل مطابقت ندارد', 400)
  }

  const detected = validateMagicBytes(buffer)
  if (!detected.valid || !detected.kind) {
    return reject(media.id, media.storageKey, 'unsupported_format', 'فرمت فایل پشتیبانی نمی‌شود', 400)
  }

  const declaredKind = media.declaredType?.startsWith('video/') ? 'video' : 'image'
  if (detected.kind !== declaredKind) {
    return reject(
      media.id,
      media.storageKey,
      'type_mismatch',
      'نوع فایل واقعی با نوع اعلام‌شده مطابقت ندارد',
      400
    )
  }

  let width: number | null = detected.width ?? null
  let height: number | null = detected.height ?? null
  let thumbnailUrl: string | null = null
  let durationMs: number | null = null
  let codec: string | null = null

  if (detected.kind === 'image') {
    try {
      const img = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS })
      const metadata = await img.metadata()
      width = metadata.width ?? width
      height = metadata.height ?? height

      if (
        !width ||
        !height ||
        width > MAX_IMAGE_DIMENSION ||
        height > MAX_IMAGE_DIMENSION ||
        width * height > MAX_IMAGE_PIXELS
      ) {
        return reject(
          media.id,
          media.storageKey,
          'image_too_large',
          'ابعاد تصویر بیش از حد مجاز است',
          400
        )
      }

      const thumbBuffer = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS })
        .resize(400, 400, { fit: 'cover', position: 'center' })
        .webp({ quality: 80 })
        .toBuffer()

      const thumbKey = buildDerivedKey(media.storageKey, 'thumb.webp')
      thumbnailUrl = await putObject(thumbKey, thumbBuffer, 'image/webp')
    } catch {
      return reject(media.id, media.storageKey, 'decode_failed', 'پردازش تصویر ناموفق بود', 400)
    }
  }
  if (detected.kind === 'video') {
    // Issue #146 follow-up: extract duration/codec via ffprobe and generate a
    // real thumbnail frame via ffmpeg (both ship as prebuilt binaries through
    // @ffprobe-installer/ffprobe + @ffmpeg-installer/ffmpeg — no system ffmpeg
    // dependency). Best-effort: a probe/thumbnail failure does not reject the
    // upload, it just leaves durationMs/codec/thumbnail null.
    try {
      const probeType = detected.type === 'mov' || detected.type === 'webm' ? detected.type : 'mp4'
      const probed = await probeVideo(buffer, probeType)
      durationMs = probed.durationMs
      codec = probed.codec
      if (probed.thumbnail) {
        const thumbKey = buildDerivedKey(media.storageKey, 'thumb.jpg')
        thumbnailUrl = await putObject(thumbKey, probed.thumbnail, 'image/jpeg')
      }
    } catch (err) {
      console.error('[media/confirm] video probe failed (non-fatal):', err)
    }
  }

  const publicUrl = publicUrlFor(media.storageKey)

  const updated = await db.media.update({
    where: { id: media.id },
    data: {
      status: 'validated',
      detectedType: detected.type,
      width,
      height,
      url: publicUrl,
      thumbnailUrl: thumbnailUrl ?? publicUrl,
      durationMs,
      codec,
      validatedAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true, media: toMediaPayload(updated) })
}

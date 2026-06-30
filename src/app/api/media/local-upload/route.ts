/**
 * PUT /api/media/local-upload?key=... — dev-only upload transport. (Issue #146)
 *
 * Mirrors what an S3 presigned PUT would do: the body is streamed straight to
 * disk (never buffered fully in memory) while a sha256 checksum and the real
 * byte count are computed on the fly. The key must exactly match a "pending"
 * Media row created by /api/media/presign for this workspace — a client
 * cannot upload to an arbitrary key. This route is intentionally restricted
 * to local-dev (S3 not configured); production must use S3.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { isValidStorageKey, safeLocalPath, isS3Configured } from '@/lib/storage'
import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import { mkdir, rm } from 'fs/promises'
import path from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BODY_BYTES = 200 * 1024 * 1024 // 200MB hard ceiling — matches presign's video cap

export async function PUT(req: NextRequest) {
  if (isS3Configured) {
    return NextResponse.json(
      { error: 'این مسیر فقط برای توسعه محلی است؛ از S3 استفاده کنید' },
      { status: 403 }
    )
  }

  const guard = await requirePermissionApi('media.upload')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const key = req.nextUrl.searchParams.get('key') ?? ''
  if (!key || !isValidStorageKey(key, workspaceId)) {
    return NextResponse.json({ error: 'کلید ذخیره‌سازی نامعتبر است' }, { status: 400 })
  }

  const media = await db.media.findFirst({
    where: { workspaceId, storageKey: key, status: 'pending' },
  })
  if (!media) {
    return NextResponse.json({ error: 'آپلود معتبر یافت نشد یا قبلاً انجام شده است' }, { status: 404 })
  }
  if (media.uploaderId && media.uploaderId !== guard.userId) {
    return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  }
  if (media.expiresAt && media.expiresAt < new Date()) {
    await db.media.update({
      where: { id: media.id },
      data: { status: 'rejected', rejectedReason: 'upload_expired' },
    })
    return NextResponse.json({ error: 'مهلت آپلود منقضی شده است' }, { status: 410 })
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0')
  if (!contentLength || contentLength <= 0) {
    return NextResponse.json({ error: 'طول محتوا نامشخص است' }, { status: 411 })
  }
  if (contentLength > MAX_BODY_BYTES || contentLength !== media.fileSize) {
    return NextResponse.json({ error: 'حجم فایل با مقدار اعلام‌شده مطابقت ندارد' }, { status: 413 })
  }
  if (!req.body) {
    return NextResponse.json({ error: 'بدنه درخواست خالی است' }, { status: 400 })
  }

  const destPath = safeLocalPath(key)
  await mkdir(path.dirname(destPath), { recursive: true })

  const hash = createHash('sha256')
  let bytesWritten = 0
  const declaredSize = media.fileSize

  // Hash + count bytes as they stream through, abort early if the body
  // exceeds what was declared at presign time (don't trust Content-Length alone).
  const hashingTransform = new Transform({
    transform(chunk: Buffer, _enc, callback) {
      bytesWritten += chunk.length
      if (bytesWritten > declaredSize) {
        callback(new Error('body_exceeds_declared_size'))
        return
      }
      hash.update(chunk)
      callback(null, chunk)
    },
  })

  const nodeReadable = Readable.fromWeb(req.body as any)
  const writeStream = createWriteStream(destPath)

  try {
    await pipeline(nodeReadable, hashingTransform, writeStream)
  } catch {
    await rm(destPath, { force: true })
    await db.media.update({
      where: { id: media.id },
      data: { status: 'rejected', rejectedReason: 'upload_stream_error' },
    })
    return NextResponse.json({ error: 'خطا در آپلود فایل' }, { status: 400 })
  }

  if (bytesWritten !== declaredSize) {
    await rm(destPath, { force: true })
    await db.media.update({
      where: { id: media.id },
      data: { status: 'rejected', rejectedReason: 'size_mismatch' },
    })
    return NextResponse.json({ error: 'حجم فایل آپلودشده مطابقت ندارد' }, { status: 400 })
  }

  await db.media.update({
    where: { id: media.id },
    data: {
      status: 'uploaded',
      actualSize: bytesWritten,
      checksumAlgo: 'sha256',
      checksumValue: hash.digest('hex'),
    },
  })

  return NextResponse.json({ ok: true })
}

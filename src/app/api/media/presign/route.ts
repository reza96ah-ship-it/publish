/**
 * POST /api/media/presign â€” get a presigned URL for direct-to-S3 upload.
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

export const dynamic = 'force-dynamic'

const presignSchema = z.object({
  fileName: z
    .string()
    .min(1, 'ظ†ط§ظ… ظپط§غŒظ„ ط§ظ„ط²ط§ظ…غŒ ط§ط³طھ')
    .max(200, 'ظ†ط§ظ… ظپط§غŒظ„ ط®غŒظ„غŒ ط·ظˆظ„ط§ظ†غŒ ط§ط³طھ'),
  fileType: z
    .string()
    .regex(
      /^image\/(jpeg|png|webp|gif)$/,
      'ظپط±ظ…طھ ظپط§غŒظ„ ط¨ط§غŒط¯ jpeg, png, webp غŒط§ gif ط¨ط§ط´ط¯'
    ),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(10_485_760, 'ط­ط¯ط§ع©ط«ط± ط­ط¬ظ… ظپط§غŒظ„ غ±غ° ظ…ع¯ط§ط¨ط§غŒطھ ط§ط³طھ'), // 10MB
})

const STORAGE_QUOTA_BYTES = 500 * 1024 * 1024 // 500MB per workspace

export async function POST(req: NextRequest) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'ط¨ط¯ظ†ظ‡ ظ†ط§ظ…ط¹طھط¨ط±' }, { status: 400 })

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
    return NextResponse.json(
      {
        error: `ط³ظ‚ظپ ط°ط®غŒط±ظ‡â€Œط³ط§ط²غŒ طھع©ظ…غŒظ„ ط§ط³طھ. ظپط¶ط§غŒ ط¨ط§ظ‚غŒظ…ط§ظ†ط¯ظ‡: ${Math.round(remaining / 1024 / 1024)} ظ…ع¯ط§ط¨ط§غŒطھ`,
      },
      { status: 413 }
    )
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

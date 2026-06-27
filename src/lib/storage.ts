/**
 * S3-compatible object storage — presigned URL uploads + validation.
 *
 * Supports: AWS S3, Cloudflare R2, MinIO, Backblaze B2 (any S3-compatible).
 *
 * Flow:
 *   1. Client → POST /api/media/presign → gets { uploadUrl, key, mediaId }
 *   2. Client uploads file directly to S3 via PUT uploadUrl (bypasses Next.js)
 *   3. Client → POST /api/media/confirm → server validates + creates Media record
 *
 * If S3 is not configured (S3_ENDPOINT empty), falls back to local disk
 * (uploads to public/uploads/ — dev mode only).
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs/promises'

const S3_ENDPOINT = process.env.S3_ENDPOINT || ''
const S3_BUCKET = process.env.S3_BUCKET || 'nashrino-media'
const S3_REGION = process.env.S3_REGION || 'us-east-1'
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || ''
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || ''
const CDN_BASE_URL = process.env.CDN_BASE_URL || ''

export const isS3Configured = !!(S3_ENDPOINT && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY)

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
      // For R2/MinIO, force path-style addressing
      forcePathStyle: !S3_ENDPOINT.includes('amazonaws.com'),
    })
  }
  return s3Client
}

/**
 * Generate a presigned URL for direct-to-S3 upload.
 * Returns { uploadUrl, key, publicUrl } — client PUTs the file to uploadUrl.
 */
export async function createPresignedUpload(opts: {
  fileName: string
  fileType: string
  workspaceId: string
}): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  const ext = path.extname(opts.fileName) || guessExtFromType(opts.fileType)
  const key = `${opts.workspaceId}/${randomUUID()}${ext}`

  if (isS3Configured) {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: opts.fileType,
    })
    const uploadUrl = await getSignedUrl(getS3Client(), command, {
      expiresIn: 300, // 5 minutes
    })
    const publicUrl = CDN_BASE_URL ? `${CDN_BASE_URL}/${key}` : `${S3_ENDPOINT}/${S3_BUCKET}/${key}`
    return { uploadUrl, key, publicUrl }
  }

  // Dev fallback: return a local upload URL (server handles the PUT)
  const publicUrl = `/uploads/${key}`
  const uploadUrl = `/api/media/local-upload?key=${encodeURIComponent(key)}`
  return { uploadUrl, key, publicUrl }
}

/**
 * Validate that a buffer is a real image by checking magic bytes.
 * Returns the detected type or null if not a valid image.
 */
export function validateMagicBytes(buffer: Buffer): {
  valid: boolean
  type: 'jpeg' | 'png' | 'webp' | 'gif' | null
  width?: number
  height?: number
} {
  if (buffer.length < 12) return { valid: false, type: null }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, type: 'jpeg' }
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e &&
    buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a &&
    buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)
    return { valid: true, type: 'png', width, height }
  }
  // WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 &&
    buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 &&
    buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { valid: true, type: 'webp' }
  }
  // GIF: 47 49 46 38 (GIF8)
  if (
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    const width = buffer.readUInt16LE(6)
    const height = buffer.readUInt16LE(8)
    return { valid: true, type: 'gif', width, height }
  }

  return { valid: false, type: null }
}

/**
 * Download an object from S3 (for validation on confirm).
 * Returns the buffer (first 1KB for magic-byte check).
 */
export async function fetchObjectHead(key: string): Promise<Buffer | null> {
  if (!isS3Configured) {
    // Dev fallback: read from local disk
    try {
      const localPath = path.join(process.cwd(), 'public', 'uploads', key)
      return await fs.readFile(localPath)
    } catch {
      return null
    }
  }

  try {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key })
    const response = await getS3Client().send(command)
    if (!response.Body) return null
    // Read first 1KB for magic-byte validation
    const chunks: Uint8Array[] = []
    const reader = response.Body as any
    for await (const chunk of reader) {
      chunks.push(chunk)
      if (chunks.reduce((a, c) => a + c.length, 0) > 1024) break
    }
    return Buffer.concat(chunks)
  } catch {
    return null
  }
}

/**
 * Delete an object from S3 (for cleanup on validation failure).
 */
export async function deleteObject(key: string): Promise<void> {
  if (!isS3Configured) {
    try {
      const localPath = path.join(process.cwd(), 'public', 'uploads', key)
      await fs.unlink(localPath)
    } catch {
      // ignore
    }
    return
  }

  try {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
    const command = new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key })
    await getS3Client().send(command)
  } catch {
    // ignore — best-effort cleanup
  }
}

function guessExtFromType(type: string): string {
  if (type === 'image/jpeg') return '.jpg'
  if (type === 'image/png') return '.png'
  if (type === 'image/webp') return '.webp'
  if (type === 'image/gif') return '.gif'
  return ''
}

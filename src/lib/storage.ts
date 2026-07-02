/**
 * S3-compatible object storage — presigned URL uploads + validation. (Issue #146)
 *
 * Supports: AWS S3, Cloudflare R2, MinIO, Backblaze B2 (any S3-compatible).
 *
 * Flow:
 *   1. Client → POST /api/media/presign → gets { uploadUrl, key, mediaId } and a
 *      "pending" Media row (not yet usable/visible — see prisma schema).
 *   2. Client uploads the file (PUT in production via the presigned S3 URL,
 *      or POST to /api/media/local-upload in dev).
 *   3. Client → POST /api/media/confirm → server re-fetches the object, verifies
 *      checksum/size/real content type, and only then flips status to "validated".
 *
 * If S3 is not configured (S3_ENDPOINT empty), falls back to local disk
 * (uploads to public/uploads/<workspaceId>/... — dev mode only).
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID, createHash } from 'crypto'
import path from 'path'
import fs from 'fs/promises'

const S3_ENDPOINT = process.env.S3_ENDPOINT || ''
const S3_BUCKET = process.env.S3_BUCKET || 'nashrino-media'
const S3_REGION = process.env.S3_REGION || 'us-east-1'
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || ''
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || ''
const CDN_BASE_URL = process.env.CDN_BASE_URL || ''

export const isS3Configured = !!(S3_ENDPOINT && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY)
export const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

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
 * Build a server-owned, unpredictable storage key under the workspace prefix.
 * Never derived from client input beyond the file extension.
 */
export function buildStorageKey(workspaceId: string, fileType: string): string {
  const ext = guessExtFromType(fileType)
  return `${workspaceId}/${randomUUID()}${ext}`
}

/**
 * Generate a presigned URL for direct-to-S3 upload, or a local-dev upload
 * endpoint URL when S3 isn't configured. `key` is always server-generated
 * (see buildStorageKey) — callers must not accept a key from the client.
 */
export async function createPresignedUpload(opts: {
  key: string
  fileType: string
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  if (isS3Configured) {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: opts.key,
      ContentType: opts.fileType,
    })
    const uploadUrl = await getSignedUrl(getS3Client(), command, {
      expiresIn: 300, // 5 minutes
    })
    const publicUrl = CDN_BASE_URL
      ? `${CDN_BASE_URL}/${opts.key}`
      : `${S3_ENDPOINT}/${S3_BUCKET}/${opts.key}`
    return { uploadUrl, publicUrl }
  }

  // Dev fallback: local-upload route streams the PUT body to disk
  const publicUrl = `/uploads/${opts.key}`
  const uploadUrl = `/api/media/local-upload?key=${encodeURIComponent(opts.key)}`
  return { uploadUrl, publicUrl }
}

export type DetectedMediaType =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'gif'
  | 'mp4'
  | 'mov'
  | 'webm'

export interface MagicByteResult {
  valid: boolean
  type: DetectedMediaType | null
  kind: 'image' | 'video' | null
  width?: number
  height?: number
}

/**
 * Validate that a buffer is a real, supported media file by checking magic
 * bytes (not the filename or the client-declared content-type).
 */
export function validateMagicBytes(buffer: Buffer): MagicByteResult {
  if (buffer.length < 12) return { valid: false, type: null, kind: null }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, type: 'jpeg', kind: 'image' }
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)
    return { valid: true, type: 'png', kind: 'image', width, height }
  }
  // WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, type: 'webp', kind: 'image' }
  }
  // GIF: 47 49 46 38 (GIF8)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    const width = buffer.readUInt16LE(6)
    const height = buffer.readUInt16LE(8)
    return { valid: true, type: 'gif', kind: 'image', width, height }
  }
  // MP4/MOV: ISO base media file format — 'ftyp' box at byte offset 4
  if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    const brand = buffer.subarray(8, 12).toString('ascii')
    if (brand.startsWith('qt')) return { valid: true, type: 'mov', kind: 'video' }
    return { valid: true, type: 'mp4', kind: 'video' }
  }
  // WebM/Matroska: EBML header 1A 45 DF A3
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { valid: true, type: 'webm', kind: 'video' }
  }

  return { valid: false, type: null, kind: null }
}

/** sha256 checksum of a full buffer (used to verify upload integrity on confirm). */
export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Fetch the full object body (S3 or local disk) for confirm-time validation.
 * Returns null if the object does not exist.
 */
export async function fetchObject(key: string): Promise<Buffer | null> {
  if (!isS3Configured) {
    try {
      const localPath = safeLocalPath(key)
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
    const chunks: Uint8Array[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reader = response.Body as any
    for await (const chunk of reader) chunks.push(chunk)
    return Buffer.concat(chunks)
  } catch {
    return null
  }
}

/** Delete an object from storage (cleanup on validation failure or explicit deletion). */
export async function deleteObject(key: string): Promise<void> {
  if (!isS3Configured) {
    try {
      await fs.unlink(safeLocalPath(key))
    } catch {
      // ignore — best-effort cleanup
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

/**
 * Resolve a storage key to a local filesystem path, rejecting any key that
 * would escape the uploads directory (path traversal).
 */
export function safeLocalPath(key: string): string {
  const resolved = path.resolve(UPLOAD_DIR, key)
  if (!resolved.startsWith(UPLOAD_DIR + path.sep) && resolved !== UPLOAD_DIR) {
    throw new Error('invalid storage key')
  }
  return resolved
}

/** A storage key is valid only if it matches the server-generated shape we issue at presign time. */
export function isValidStorageKey(key: string, workspaceId: string): boolean {
  const pattern = new RegExp(
    `^${workspaceId}/[0-9a-f-]{36}(\\.[a-z0-9]+)?$`
  )
  return pattern.test(key)
}

/** Build the storage key for a derived asset (thumbnail/preview) from the original key. */
export function buildDerivedKey(originalKey: string, suffix: string): string {
  const dir = path.dirname(originalKey)
  const base = path.basename(originalKey, path.extname(originalKey))
  return `${dir}/${base}.${suffix}`
}

/** Write a buffer to storage at the given key (used for derived thumbnails). */
export async function putObject(key: string, buffer: Buffer, _contentType: string): Promise<string> {
  if (!isS3Configured) {
    const dest = safeLocalPath(key)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, buffer)
    return `/uploads/${key}`
  }

  const { PutObjectCommand: Put } = await import('@aws-sdk/client-s3')
  await getS3Client().send(
    new Put({ Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: _contentType })
  )
  return CDN_BASE_URL ? `${CDN_BASE_URL}/${key}` : `${S3_ENDPOINT}/${S3_BUCKET}/${key}`
}

/** Public delivery URL for an already-stored object. */
export function publicUrlFor(key: string): string {
  if (!isS3Configured) return `/uploads/${key}`
  return CDN_BASE_URL ? `${CDN_BASE_URL}/${key}` : `${S3_ENDPOINT}/${S3_BUCKET}/${key}`
}

function guessExtFromType(type: string): string {
  if (type === 'image/jpeg') return '.jpg'
  if (type === 'image/png') return '.png'
  if (type === 'image/webp') return '.webp'
  if (type === 'image/gif') return '.gif'
  if (type === 'video/mp4') return '.mp4'
  if (type === 'video/quicktime') return '.mov'
  if (type === 'video/webm') return '.webm'
  return ''
}

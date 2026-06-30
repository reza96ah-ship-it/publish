/**
 * Issue #146: Abandoned media-upload cleanup.
 *
 * Runs hourly inside the publish-worker. Removes:
 *   - "pending"/"uploaded"/"validating" Media rows whose presign expiry passed
 *     without ever reaching /api/media/confirm
 *   - "rejected" rows older than the audit-retention window
 *
 * Storage cleanup currently only deletes local-disk objects (public/uploads/).
 * S3 cleanup is a follow-up — this worker doesn't carry the @aws-sdk/client-s3
 * dependency yet, so in an S3-configured deployment the DB row is removed but
 * the remote object is not (tracked as a known limitation, not silently dropped).
 *
 * Idempotent: re-runs delete zero rows once nothing is past its expiry.
 */

import path from 'path'
import { unlink } from 'fs/promises'
import { db } from './db'

const SCAN_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
const REJECTED_RETENTION_MS = 24 * 60 * 60 * 1000 // 1 day

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const isS3Configured = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY)

let cleanupTimer: ReturnType<typeof setInterval> | null = null

export function startMediaCleanup(): void {
  if (cleanupTimer) return
  setTimeout(() => {
    cleanupAbandonedMedia().catch((err) => console.error('[media-cleanup] initial cleanup failed:', err))
  }, 45_000)
  cleanupTimer = setInterval(() => {
    cleanupAbandonedMedia().catch((err) => console.error('[media-cleanup] scheduled cleanup failed:', err))
  }, SCAN_INTERVAL_MS)
  console.log('[media-cleanup] started — purges abandoned uploads every hour')
}

export function stopMediaCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
    console.log('[media-cleanup] stopped')
  }
}

async function deleteLocalObject(key: string): Promise<void> {
  if (isS3Configured || !key) return
  try {
    const resolved = path.resolve(UPLOAD_DIR, key)
    if (!resolved.startsWith(UPLOAD_DIR + path.sep)) return // refuse to delete outside uploads dir
    await unlink(resolved)
  } catch {
    // best-effort — object may already be gone
  }
}

export async function cleanupAbandonedMedia(
  now: Date = new Date()
): Promise<{ expiredPending: number; rejectedPurged: number }> {
  const expired = await db.media.findMany({
    where: { status: { in: ['pending', 'uploaded', 'validating'] }, expiresAt: { lt: now } },
    select: { id: true, storageKey: true },
  })
  for (const row of expired) await deleteLocalObject(row.storageKey)
  if (expired.length > 0) {
    await db.media.deleteMany({ where: { id: { in: expired.map((r) => r.id) } } })
    console.log(`[media-cleanup] purged ${expired.length} abandoned pending upload(s)`)
  }

  const staleRejected = await db.media.findMany({
    where: { status: 'rejected', createdAt: { lt: new Date(now.getTime() - REJECTED_RETENTION_MS) } },
    select: { id: true },
  })
  if (staleRejected.length > 0) {
    await db.media.deleteMany({ where: { id: { in: staleRejected.map((r) => r.id) } } })
    console.log(`[media-cleanup] purged ${staleRejected.length} stale rejected row(s)`)
  }

  return { expiredPending: expired.length, rejectedPurged: staleRejected.length }
}

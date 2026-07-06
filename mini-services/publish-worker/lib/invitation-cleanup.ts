/**
 * Issue #143: Expired workspace invitation cleanup.
 *
 * Runs daily inside the publish-worker. Deletes WorkspaceInvitation rows
 * where the token has expired AND the invitation was never accepted/revoked.
 *
 * Why delete rather than soft-mark:
 *   The schema has @@unique([workspaceId, emailNormalized]), so an expired
 *   invitation blocks re-inviting the same email until it's removed.
 *   Deleting is the correct action — the invitation is meaningless after expiry.
 *
 * Idempotent: re-runs delete zero rows if nothing has expired since the last run.
 */

import { db } from './db'

const SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

let cleanupTimer: ReturnType<typeof setInterval> | null = null

export function startInvitationCleanup(): void {
  if (cleanupTimer) return
  // Delay first run by 30s to let the DB connection pool warm up.
  setTimeout(() => {
    purgeExpiredInvitations().catch((err) =>
      console.error('[invitation-cleanup] initial cleanup failed:', err)
    )
  }, 30_000)
  cleanupTimer = setInterval(() => {
    purgeExpiredInvitations().catch((err) =>
      console.error('[invitation-cleanup] scheduled cleanup failed:', err)
    )
  }, SCAN_INTERVAL_MS)
  console.log('[invitation-cleanup] started — purges expired invitations every 24h')
}

export function stopInvitationCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
    console.log('[invitation-cleanup] stopped')
  }
}

/**
 * Delete all expired, non-accepted, non-revoked invitation records.
 * Exported for unit testing.
 */
export async function purgeExpiredInvitations(now: Date = new Date()): Promise<{ deleted: number }> {
  const result = await db.workspaceInvitation.deleteMany({
    where: {
      expiresAt: { lt: now },
      acceptedAt: null,
      revokedAt: null,
    },
  })

  if (result.count > 0) {
    console.log(`[invitation-cleanup] purged ${result.count} expired invitation(s)`)
  }

  return { deleted: result.count }
}

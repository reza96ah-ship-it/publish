/**
 * Issue #116: Instagram/LinkedIn token expiry scanner.
 *
 * Runs on a periodic timer inside the publish-worker. Finds OAuth access
 * tokens (Instagram/LinkedIn — 60-day long-lived) that are about to expire
 * and creates in-app notifications so users can reconnect BEFORE publications
 * start failing with auth errors.
 *
 * Lifecycle:
 *   - 7 days before expiry → "token_expiring" notification
 *   - 1 day before expiry  → "token_expiring_urgent" notification
 *   - Expired              → Platform.status = 'expired', "token_expired" notification
 *
 * Expired tokens surface as `errorCategory: 'auth'` in PublicationAttempt
 * (never retried — the worker throws UnrecoverableError for auth failures).
 *
 * Design: idempotent — uses Notification.type + a metadata fingerprint
 * (platformId + daysRemaining) so re-runs don't create duplicate alerts.
 */

import { db } from './db'

const SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const WARN_7_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const WARN_1_DAY_MS = 1 * 24 * 60 * 60 * 1000

let scanTimer: ReturnType<typeof setInterval> | null = null

export function startTokenExpiryScanner(): void {
  if (scanTimer) return
  // Run once at startup (after 10s to let other systems boot), then every 24h.
  setTimeout(() => {
    scanExpiringTokens().catch((err) =>
      console.error('[token-scanner] initial scan failed:', err)
    )
  }, 10_000)
  scanTimer = setInterval(() => {
    scanExpiringTokens().catch((err) =>
      console.error('[token-scanner] scheduled scan failed:', err)
    )
  }, SCAN_INTERVAL_MS)
  console.log('[token-scanner] started — scans every 24h for expiring OAuth tokens')
}

export function stopTokenExpiryScanner(): void {
  if (scanTimer) {
    clearInterval(scanTimer)
    scanTimer = null
    console.log('[token-scanner] stopped')
  }
}

/**
 * Scan all platforms with a tokenExpiresAt set (Instagram/LinkedIn).
 * Create notifications for soon-expiring tokens and mark expired ones.
 *
 * Exported for unit testing.
 */
export async function scanExpiringTokens(now: Date = new Date()): Promise<{
  warned7d: number
  warned1d: number
  expired: number
}> {
  const result = { warned7d: 0, warned1d: 0, expired: 0 }

  // Find all OAuth platforms with a known expiry date.
  // Bot-token platforms (Telegram/Bale/Rubika) have tokenExpiresAt = null and are skipped.
  const platforms = await db.platform.findMany({
    where: {
      tokenExpiresAt: { not: null },
      type: { in: ['instagram', 'linkedin'] },
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      type: true,
      tokenExpiresAt: true,
      status: true,
    },
  })

  for (const p of platforms) {
    if (!p.tokenExpiresAt) continue
    const msUntilExpiry = p.tokenExpiresAt.getTime() - now.getTime()

    if (msUntilExpiry <= 0) {
      // Expired — mark platform status + notify (once)
      await markExpired(p.id, p.workspaceId, p.name, p.type)
      result.expired++
    } else if (msUntilExpiry <= WARN_1_DAY_MS) {
      // 1-day urgent warning
      await createNotificationIfNotExists({
        workspaceId: p.workspaceId,
        type: 'token_expiring_urgent',
        title: `توکن ${p.name} تا فردا منقضی می‌شود`,
        body: `توکن ${labelFor(p.type)} ظرف ۲۴ ساعت آینده منقضی می‌شود. لطفاً هرچه زودتر حساب را مجدداً متصل کنید تا انتشار متوقف نشود.`,
        fingerprint: `${p.id}:1d`,
        platformId: p.id,
        daysRemaining: 1,
      })
      result.warned1d++
    } else if (msUntilExpiry <= WARN_7_DAYS_MS) {
      // 7-day advance warning
      await createNotificationIfNotExists({
        workspaceId: p.workspaceId,
        type: 'token_expiring',
        title: `توکن ${p.name} تا ۷ روز دیگر منقضی می‌شود`,
        body: `توکن ${labelFor(p.type)} ظرف ۷ روز آینده منقضی می‌شود. برای جلوگیری از توقف انتشار، حساب را مجدداً متصل کنید.`,
        fingerprint: `${p.id}:7d`,
        platformId: p.id,
        daysRemaining: 7,
      })
      result.warned7d++
    }
  }

  if (result.warned7d + result.warned1d + result.expired > 0) {
    console.log(
      `[token-scanner] scan complete — 7d:${result.warned7d} 1d:${result.warned1d} expired:${result.expired}`
    )
  }

  return result
}

/**
 * Mark a platform as expired and create a one-time notification.
 * The Instagram/LinkedIn adapter will return errorCategory:'auth' for expired
 * tokens, which the worker treats as UnrecoverableError (never retried).
 */
async function markExpired(
  platformId: string,
  workspaceId: string,
  platformName: string,
  platformType: string
): Promise<void> {
  await db.platform.update({
    where: { id: platformId },
    data: {
      status: 'expired',
      primaryIssue: 'توکن منقضی شده — نیاز به اتصال مجدد',
    },
  })

  await createNotificationIfNotExists({
    workspaceId,
    type: 'token_expired',
    title: `توکن ${platformName} منقضی شد`,
    body: `توکن ${labelFor(platformType)} منقضی شده است. انتشار به این پلتفرم متوقف شد. لطفاً حساب را مجدداً متصل کنید.`,
    fingerprint: `${platformId}:expired`,
    platformId,
    daysRemaining: 0,
  })
}

/**
 * Create a notification only if one with the same fingerprint hasn't already
 * been created. This makes the scanner idempotent — re-runs don't spam users.
 *
 * We store the fingerprint in the Notification body as a hidden prefix so we
 * can check without a schema change. (A dedicated column would be cleaner but
 * requires a migration; this is sufficient for the 7d/1d/expired lifecycle.)
 */
async function createNotificationIfNotExists(args: {
  workspaceId: string
  type: string
  title: string
  body: string
  fingerprint: string
  platformId: string
  daysRemaining: number
}): Promise<void> {
  // Check for an existing notification with this fingerprint (last 14 days)
  const existing = await db.notification.findFirst({
    where: {
      workspaceId: args.workspaceId,
      type: args.type,
      body: { startsWith: `<!--fp:${args.fingerprint}-->` },
      createdAt: { gt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  })
  if (existing) return

  await db.notification.create({
    data: {
      workspaceId: args.workspaceId,
      type: args.type,
      title: args.title,
      body: `<!--fp:${args.fingerprint}-->${args.body}`,
    },
  })
}

function labelFor(platformType: string): string {
  switch (platformType) {
    case 'instagram':
      return 'اینستاگرام'
    case 'linkedin':
      return 'لینکدین'
    default:
      return platformType
  }
}

import { Prisma } from '@prisma/client'

export const INBOX_SLA_TARGET_MINUTES = 120

export interface InboxMetricCounts {
  threadUnread: number
  legacyUnread: number
  threadSlaRisk: number
  legacySlaRisk: number
}

export interface InboxOperationalMetrics extends InboxMetricCounts {
  unreadInbox: number
  slaRisk: number
  slaTargetMinutes: number
}

type CountRow = { count: number | bigint | string | null }

function asNumber(value: number | bigint | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function positiveInt(value: number): number {
  return Math.max(0, Math.floor(value))
}

export function combineInboxMetricCounts(
  counts: InboxMetricCounts,
  slaTargetMinutes = INBOX_SLA_TARGET_MINUTES
): InboxOperationalMetrics {
  const threadUnread = positiveInt(counts.threadUnread)
  const legacyUnread = positiveInt(counts.legacyUnread)
  const threadSlaRisk = positiveInt(counts.threadSlaRisk)
  const legacySlaRisk = positiveInt(counts.legacySlaRisk)

  return {
    threadUnread,
    legacyUnread,
    threadSlaRisk,
    legacySlaRisk,
    unreadInbox: threadUnread + legacyUnread,
    slaRisk: threadSlaRisk + legacySlaRisk,
    slaTargetMinutes,
  }
}

function legacyUnmirroredPredicate(workspaceId: string) {
  return Prisma.sql`
    im."workspaceId" = ${workspaceId}
    AND NOT EXISTS (
      SELECT 1
      FROM "InboxThreadMessage" itm
      WHERE itm."workspaceId" = im."workspaceId"
        AND itm."platformId" = im."platformId"
        AND im."externalId" IS NOT NULL
        AND itm."providerMessageId" = im."externalId"
    )
  `
}

async function readCount(query: Prisma.Sql): Promise<number> {
  const { db } = await import('@/lib/db')
  const rows = await db.$queryRaw<CountRow[]>(query)
  return asNumber(rows[0]?.count)
}

export async function getInboxOperationalMetrics(
  workspaceId: string,
  now = new Date()
): Promise<InboxOperationalMetrics> {
  const slaCutoff = new Date(now.getTime() - INBOX_SLA_TARGET_MINUTES * 60_000)
  const legacyPredicate = legacyUnmirroredPredicate(workspaceId)

  const [threadUnread, legacyUnread, threadSlaRisk, legacySlaRisk] = await Promise.all([
    readCount(Prisma.sql`
      SELECT COALESCE(SUM("unreadCount"), 0)::int AS count
      FROM "InboxThread"
      WHERE "workspaceId" = ${workspaceId}
    `),
    readCount(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "InboxMessage" im
      WHERE ${legacyPredicate}
        AND im."isRead" = false
    `),
    readCount(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "InboxThread"
      WHERE "workspaceId" = ${workspaceId}
        AND "status" <> 'resolved'
        AND "firstResponseAt" IS NULL
        AND "slaStartedAt" <= ${slaCutoff}
    `),
    readCount(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "InboxMessage" im
      WHERE ${legacyPredicate}
        AND im."status" <> 'resolved'
        AND im."firstResponseAt" IS NULL
        AND COALESCE(im."slaStartedAt", im."createdAt") <= ${slaCutoff}
    `),
  ])

  return combineInboxMetricCounts({
    threadUnread,
    legacyUnread,
    threadSlaRisk,
    legacySlaRisk,
  })
}

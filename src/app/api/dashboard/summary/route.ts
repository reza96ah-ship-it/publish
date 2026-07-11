import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { getInboxOperationalMetrics } from '@/modules/inbox/metrics'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // P8.3: Fixed N+1 — use groupBy instead of findMany + filter
  const [jobCounts, inboxMetrics, pendingContent, platformCounts, campaigns, publishedToday] =
    await Promise.all([
      db.publishJob.groupBy({
        by: ['status'],
        where: { workspaceId },
        _count: { _all: true },
      }),
      getInboxOperationalMetrics(workspaceId),
      db.content.count({ where: { workspaceId, status: 'review' } }),
      db.platform.groupBy({
        by: ['status'],
        where: { workspaceId },
        _count: { _all: true },
      }),
      db.campaign.count({ where: { workspaceId, status: 'active' } }),
      db.publishJob.count({
        where: { workspaceId, status: 'success', completedAt: { gte: today } },
      }),
    ])

  // Build status → count map
  const jobMap = new Map(jobCounts.map((j) => [j.status, j._count._all]))
  const failed = (jobMap.get('failed') ?? 0) + (jobMap.get('action') ?? 0)
  const queued = (jobMap.get('pending') ?? 0) + (jobMap.get('scheduled') ?? 0)
  const processing = jobMap.get('processing') ?? 0

  // Count disconnected platforms
  const platMap = new Map(platformCounts.map((p) => [p.status, p._count._all]))
  const disconnected =
    (platMap.get('error') ?? 0) + (platMap.get('expired') ?? 0) + (platMap.get('disconnected') ?? 0)
  const unreadInbox = inboxMetrics.unreadInbox
  const slaRisk = inboxMetrics.slaRisk

  const health =
    failed > 2 || disconnected > 1 || slaRisk > 5
      ? 'critical'
      : failed > 0 || disconnected > 0 || slaRisk > 0
        ? 'warning'
        : 'healthy'
  const healthLabel =
    health === 'healthy'
      ? 'پایدار'
      : health === 'warning'
        ? 'نیازمند توجه'
        : 'بحرانی'
  const healthColor =
    health === 'healthy'
      ? 'text-success bg-success-tint border-success-soft'
      : health === 'warning'
        ? 'text-warning bg-warning-tint border-warning-soft'
        : 'text-danger bg-danger-tint border-danger-soft'

  return NextResponse.json({
    health,
    healthLabel,
    healthColor,
    publishedToday,
    queued,
    processing,
    failed,
    pendingApproval: pendingContent,
    unreadInbox,
    activeCampaigns: campaigns,
    disconnected,
    slaRisk,
    inboxThreadUnread: inboxMetrics.threadUnread,
    inboxLegacyUnread: inboxMetrics.legacyUnread,
    inboxSlaTargetMinutes: inboxMetrics.slaTargetMinutes,
  })
}

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'

export async function GET() {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const [jobs, unreadInbox, pendingContent, platforms, campaigns] = await Promise.all([
    db.publishJob.findMany({ where: { workspaceId }, select: { status: true } }),
    db.inboxMessage.count({ where: { workspaceId, isRead: false } }),
    db.content.count({ where: { workspaceId, status: 'review' } }),
    db.platform.findMany({ where: { workspaceId }, select: { status: true, circuitState: true } }),
    db.campaign.count({ where: { workspaceId, status: 'active' } }),
  ])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const publishedToday = await db.publishJob.count({
    where: { workspaceId, status: 'success', completedAt: { gte: today } },
  })

  const failed = jobs.filter((j) => j.status === 'failed' || j.status === 'action').length
  const queued = jobs.filter((j) => j.status === 'pending' || j.status === 'scheduled').length
  const processing = jobs.filter((j) => j.status === 'processing').length
  const disconnected = platforms.filter((p) => p.status === 'error' || p.status === 'expired' || p.status === 'disconnected' || p.circuitState === 'open').length

  const health = failed > 2 || disconnected > 1 ? 'critical' : failed > 0 || disconnected > 0 ? 'warning' : 'healthy'
  const healthLabel = health === 'healthy' ? 'پایدار' : health === 'warning' ? 'نیازمند توجه' : 'بحرانی'
  const healthColor = health === 'healthy' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : health === 'warning' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-rose-700 bg-rose-50 border-rose-200'

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
    slaRisk: Math.max(0, unreadInbox - 2),
  })
}

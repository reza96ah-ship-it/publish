import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const notifications = await db.notification.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 8,
  })

  // Primary critical task
  const failed = notifications.find((n) => n.type === 'publish_failed')
  const primary = failed
    ? {
        id: failed.id,
        type: 'critical',
        title: failed.title,
        context: failed.body ?? '',
        time: failed.createdAt,
        action: 'ط¨ط±ط±ط³غŒ ظˆ طھظ„ط§ط´ ظ…ط¬ط¯ط¯',
      }
    : null

  // Secondary tasks
  const secondary = notifications
    .filter((n) => n.id !== failed?.id)
    .map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      iconName: iconFor(n.type),
      color: colorFor(n.type),
      bg: bgFor(n.type),
      border: borderFor(n.type),
      time: n.createdAt,
      isRead: n.isRead,
    }))

  return NextResponse.json({ primary, secondary })
}

function iconFor(t: string) {
  switch (t) {
    case 'publish_failed':
      return 'AlertTriangle'
    case 'approval_requested':
      return 'CheckCircle2'
    case 'token_expiring':
      return 'ShieldAlert'
    case 'inbox_new':
      return 'Inbox'
    case 'channel_disconnected':
      return 'AlertTriangle'
    case 'publish_success':
      return 'CheckCircle2'
    default:
      return 'Bell'
  }
}
function colorFor(t: string) {
  switch (t) {
    case 'publish_failed':
    case 'channel_disconnected':
      return 'text-rose-600'
    case 'approval_requested':
      return 'text-amber-600'
    case 'token_expiring':
      return 'text-orange-600'
    case 'inbox_new':
      return 'text-blue-600'
    case 'publish_success':
      return 'text-emerald-600'
    default:
      return 'text-slate-600'
  }
}
function bgFor(t: string) {
  switch (t) {
    case 'publish_failed':
    case 'channel_disconnected':
      return 'bg-rose-50'
    case 'approval_requested':
      return 'bg-amber-50'
    case 'token_expiring':
      return 'bg-orange-50'
    case 'inbox_new':
      return 'bg-blue-50'
    case 'publish_success':
      return 'bg-emerald-50'
    default:
      return 'bg-slate-50'
  }
}
function borderFor(t: string) {
  switch (t) {
    case 'publish_failed':
    case 'channel_disconnected':
      return 'border-rose-100'
    case 'approval_requested':
      return 'border-amber-100'
    case 'token_expiring':
      return 'border-orange-100'
    case 'inbox_new':
      return 'border-blue-100'
    case 'publish_success':
      return 'border-emerald-100'
    default:
      return 'border-slate-100'
  }
}

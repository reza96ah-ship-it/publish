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
        action: 'بررسی و تلاش مجدد',
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
      return 'text-danger'
    case 'approval_requested':
      return 'text-warning'
    case 'token_expiring':
      return 'text-warning'
    case 'inbox_new':
      return 'text-info'
    case 'publish_success':
      return 'text-success'
    default:
      return 'text-ink-secondary'
  }
}
function bgFor(t: string) {
  switch (t) {
    case 'publish_failed':
    case 'channel_disconnected':
      return 'bg-danger-tint'
    case 'approval_requested':
      return 'bg-warning-tint'
    case 'token_expiring':
      return 'bg-warning-tint'
    case 'inbox_new':
      return 'bg-info-tint'
    case 'publish_success':
      return 'bg-success-tint'
    default:
      return 'bg-surface-subtle'
  }
}
function borderFor(t: string) {
  switch (t) {
    case 'publish_failed':
    case 'channel_disconnected':
      return 'border-danger-soft'
    case 'approval_requested':
      return 'border-warning-soft'
    case 'token_expiring':
      return 'border-warning-soft'
    case 'inbox_new':
      return 'border-info-soft'
    case 'publish_success':
      return 'border-success-soft'
    default:
      return 'border-border'
  }
}

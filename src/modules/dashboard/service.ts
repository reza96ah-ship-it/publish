/**
 * Issue #200: Dashboard domain module — service layer.
 *
 * Read-model service that powers the dashboard routes (action-center + pulse).
 * Business logic + DB aggregation + Persian label/color mapping lives here.
 * No HTTP. Route handlers stay thin: auth → service.getX() → response.
 */

import { db } from '@/lib/db'

export interface ActionCenterResult {
  primary: {
    id: string
    type: 'critical'
    title: string
    context: string
    time: Date
    action: string
    href: string
  } | null
  secondary: {
    id: string
    type: string
    title: string
    iconName: string
    color: string
    bg: string
    border: string
    time: Date
    isRead: boolean
    href: string | null
  }[]
}

export interface PulseItem {
  id: string
  title: string | null
  desc: string
  platform: string
  platformName: string
  status: string
  type: 'live' | 'success' | 'action' | 'scheduled'
  schedule: Date | null
  processLabel: string | null
  progress: number
  errorCategory: string | null
  assignee: string
  assigneeAvatar: string
  campaign: string
  thumbnail: string
  platformColor: string
  platformBg: string
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'text-[var(--color-platform-instagram)]',
  telegram: 'text-[var(--color-platform-telegram)]',
  linkedin: 'text-[var(--color-platform-linkedin)]',
  rubika: 'text-[var(--color-platform-rubika)]',
}

const PLATFORM_BG: Record<string, string> = {
  instagram: 'chip-instagram',
  telegram: 'chip-telegram',
  linkedin: 'chip-linkedin',
  rubika: 'chip-rubika',
}

const ACTION_CENTER_ICONS: Record<string, string> = {
  publish_failed: 'AlertTriangle',
  approval_requested: 'CheckCircle2',
  token_expiring: 'ShieldAlert',
  inbox_new: 'Inbox',
  channel_disconnected: 'AlertTriangle',
  publish_success: 'CheckCircle2',
}

const ACTION_CENTER_COLORS: Record<string, string> = {
  publish_failed: 'text-danger',
  channel_disconnected: 'text-danger',
  approval_requested: 'text-warning',
  token_expiring: 'text-warning',
  inbox_new: 'text-info',
  publish_success: 'text-success',
}

const ACTION_CENTER_BGS: Record<string, string> = {
  publish_failed: 'bg-danger-tint',
  channel_disconnected: 'bg-danger-tint',
  approval_requested: 'bg-warning-tint',
  token_expiring: 'bg-warning-tint',
  inbox_new: 'bg-info-tint',
  publish_success: 'bg-success-tint',
}

const ACTION_CENTER_BORDERS: Record<string, string> = {
  publish_failed: 'border-danger-soft',
  channel_disconnected: 'border-danger-soft',
  approval_requested: 'border-warning-soft',
  token_expiring: 'border-warning-soft',
  inbox_new: 'border-info-soft',
  publish_success: 'border-success-soft',
}

// Issue #213: destination routes for action-center items so the CTA buttons
// can actually navigate. The primary href is the most important page for the
// notification category; secondary items only get an href when we know where
// to send the user (otherwise the item stays non-interactive but focusable).
const ACTION_CENTER_HREFS: Record<string, string> = {
  publish_failed: '/calendar?status=failed',
  publish_success: '/analytics',
  approval_requested: '/inbox',
  token_expiring: '/channels',
  channel_disconnected: '/channels',
  inbox_new: '/inbox',
}

function statusLabel(s: string): string {
  switch (s) {
    case 'processing': return 'در حال پردازش'
    case 'success': return 'منتشر شد'
    case 'failed': return 'ناموفق'
    case 'action': return 'نیازمند اقدام'
    case 'scheduled': return 'در صف'
    case 'pending': return 'در انتظار'
    default: return s
  }
}

export class DashboardService {
  /**
   * GET /api/dashboard/action-center — primary critical task + secondary tasks.
   * Pulls the most recent 8 notifications for the workspace.
   */
  async getActionCenter(workspaceId: string): Promise<ActionCenterResult> {
    const notifications = await db.notification.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    })

    const failed = notifications.find((n) => n.type === 'publish_failed')
    const primary = failed
      ? {
          id: failed.id,
          type: 'critical' as const,
          title: failed.title,
          context: failed.body ?? '',
          time: failed.createdAt,
          action: 'بررسی و تلاش مجدد',
          href: ACTION_CENTER_HREFS[failed.type] ?? '/calendar',
        }
      : null

    const secondary = notifications
      .filter((n) => n.id !== failed?.id)
      .map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        iconName: ACTION_CENTER_ICONS[n.type] ?? 'Bell',
        color: ACTION_CENTER_COLORS[n.type] ?? 'text-ink-secondary',
        bg: ACTION_CENTER_BGS[n.type] ?? 'bg-surface-subtle',
        border: ACTION_CENTER_BORDERS[n.type] ?? 'border-border',
        time: n.createdAt,
        isRead: n.isRead,
        href: ACTION_CENTER_HREFS[n.type] ?? null,
      }))

    return { primary, secondary }
  }

  /**
   * GET /api/dashboard/pulse — live activity feed for the workspace.
   * Returns the 12 most recent active jobs across all statuses.
   */
  async getPulse(workspaceId: string): Promise<PulseItem[]> {
    const jobs = await db.publishJob.findMany({
      where: {
        workspaceId,
        status: { in: ['processing', 'pending', 'scheduled', 'action', 'failed', 'success'] },
      },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        processLabel: true,
        progress: true,
        thumbnailUrl: true,
        error: true,
        content: { select: { title: true, body: true, thumbnailUrl: true } },
        platform: { select: { type: true, name: true } },
        campaign: { select: { name: true } },
        assignee: { select: { name: true, avatarUrl: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 12,
    })

    return jobs.map((j) => ({
      id: j.id,
      title: j.content.title,
      desc: j.content.body?.slice(0, 60) ?? '',
      platform: j.platform.type,
      platformName: j.platform.name,
      status: statusLabel(j.status),
      type:
        j.status === 'processing'
          ? 'live'
          : j.status === 'success'
            ? 'success'
            : j.status === 'action' || j.status === 'failed'
              ? 'action'
              : 'scheduled',
      schedule: j.scheduledAt,
      processLabel: j.processLabel,
      progress: j.progress,
      // #113: expose error field for repair UI (retry/reconnect/cancel buttons)
      errorCategory: j.error ?? null,
      assignee: j.assignee?.name ?? 'بدون مسئول',
      assigneeAvatar: j.assignee?.avatarUrl ?? '',
      campaign: j.campaign?.name ?? 'بدون کمپین',
      thumbnail: j.content.thumbnailUrl ?? j.thumbnailUrl ?? '',
      platformColor: PLATFORM_COLORS[j.platform.type] ?? PLATFORM_COLORS.rubika,
      platformBg: PLATFORM_BG[j.platform.type] ?? PLATFORM_BG.rubika,
    }))
  }
}

export const dashboardService = new DashboardService()

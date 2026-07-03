import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

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

  const pulse = jobs.map((j) => ({
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
    platformColor: platformColor(j.platform.type),
    platformBg: platformBg(j.platform.type),
  }))

  return NextResponse.json(pulse)
}

function statusLabel(s: string) {
  switch (s) {
    case 'processing':
      return 'در حال پردازش'
    case 'success':
      return 'منتشر شد'
    case 'failed':
      return 'ناموفق'
    case 'action':
      return 'نیازمند اقدام'
    case 'scheduled':
      return 'در صف'
    case 'pending':
      return 'در انتظار'
    default:
      return s
  }
}

function platformColor(t: string) {
  return t === 'instagram'
    ? 'text-[var(--color-platform-instagram)]'
    : t === 'telegram'
      ? 'text-[var(--color-platform-telegram)]'
      : t === 'linkedin'
        ? 'text-[var(--color-platform-linkedin)]'
        : 'text-[var(--color-platform-rubika)]'
}
function platformBg(t: string) {
  // Returns the combined chip class for platform badge backgrounds
  return t === 'instagram'
    ? 'chip-instagram'
    : t === 'telegram'
      ? 'chip-telegram'
      : t === 'linkedin'
        ? 'chip-linkedin'
        : 'chip-rubika'
}

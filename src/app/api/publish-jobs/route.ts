import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getWorkspaceId } from '@/lib/server'

export async function GET() {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return NextResponse.json({ error: 'workspace not found' }, { status: 404 })

  const jobs = await db.publishJob.findMany({
    where: { workspaceId },
    include: {
      content: { select: { title: true, thumbnailUrl: true } },
      platform: { select: { type: true, name: true } },
      campaign: { select: { name: true } },
      assignee: { select: { name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(jobs.map((j) => ({
    id: j.id,
    title: j.content.title,
    thumbnail: j.content.thumbnailUrl ?? j.thumbnailUrl ?? '',
    platform: j.platform.type,
    platformName: j.platform.name,
    status: j.status,
    statusLabel: statusLabel(j.status),
    progress: j.progress,
    processLabel: j.processLabel,
    scheduledAt: j.scheduledAt,
    completedAt: j.completedAt,
    error: j.error,
    retryCount: j.retryCount,
    assignee: j.assignee?.name ?? '—',
    assigneeAvatar: j.assignee?.avatarUrl ?? '',
    campaign: j.campaign?.name ?? 'بدون کمپین',
  })))
}

function statusLabel(s: string) {
  switch (s) {
    case 'processing': return 'در حال پردازش'
    case 'success': return 'منتشر شد'
    case 'failed': return 'ناموفق'
    case 'action': return 'نیازمند اقدام'
    case 'scheduled': return 'برنامه‌ریزی شده'
    case 'pending': return 'در انتظار'
    default: return s
  }
}

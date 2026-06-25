import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getWorkspaceId } from '@/lib/server'

export async function GET() {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return NextResponse.json({ error: 'workspace not found' }, { status: 404 })

  const jobs = await db.publishJob.findMany({
    where: { workspaceId, status: { in: ['processing', 'pending', 'scheduled', 'action', 'failed', 'success'] } },
    include: {
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
    type: j.status === 'processing' ? 'live' : j.status === 'success' ? 'success' : j.status === 'action' || j.status === 'failed' ? 'action' : 'scheduled',
    schedule: j.scheduledAt,
    processLabel: j.processLabel,
    progress: j.progress,
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
    case 'processing': return 'در حال پردازش'
    case 'success': return 'منتشر شد'
    case 'failed': return 'ناموفق'
    case 'action': return 'نیازمند اقدام'
    case 'scheduled': return 'در صف'
    case 'pending': return 'در انتظار'
    default: return s
  }
}

function platformColor(t: string) {
  return t === 'instagram' ? 'text-pink-600' : t === 'telegram' ? 'text-sky-600' : t === 'linkedin' ? 'text-blue-600' : 'text-purple-600'
}
function platformBg(t: string) {
  return t === 'instagram' ? 'bg-pink-100' : t === 'telegram' ? 'bg-sky-100' : t === 'linkedin' ? 'bg-blue-100' : 'bg-purple-100'
}

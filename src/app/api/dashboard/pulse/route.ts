import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const jobs = await db.publishJob.findMany({
    where: {
      workspaceId,
      status: { in: ['processing', 'pending', 'scheduled', 'action', 'failed', 'success'] },
    },
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
    assignee: j.assignee?.name ?? 'ط¨ط¯ظˆظ† ظ…ط³ط¦ظˆظ„',
    assigneeAvatar: j.assignee?.avatarUrl ?? '',
    campaign: j.campaign?.name ?? 'ط¨ط¯ظˆظ† ع©ظ…ظ¾غŒظ†',
    thumbnail: j.content.thumbnailUrl ?? j.thumbnailUrl ?? '',
    platformColor: platformColor(j.platform.type),
    platformBg: platformBg(j.platform.type),
  }))

  return NextResponse.json(pulse)
}

function statusLabel(s: string) {
  switch (s) {
    case 'processing':
      return 'ط¯ط± ط­ط§ظ„ ظ¾ط±ط¯ط§ط²ط´'
    case 'success':
      return 'ظ…ظ†طھط´ط± ط´ط¯'
    case 'failed':
      return 'ظ†ط§ظ…ظˆظپظ‚'
    case 'action':
      return 'ظ†غŒط§ط²ظ…ظ†ط¯ ط§ظ‚ط¯ط§ظ…'
    case 'scheduled':
      return 'ط¯ط± طµظپ'
    case 'pending':
      return 'ط¯ط± ط§ظ†طھط¸ط§ط±'
    default:
      return s
  }
}

function platformColor(t: string) {
  return t === 'instagram'
    ? 'text-pink-600'
    : t === 'telegram'
      ? 'text-sky-600'
      : t === 'linkedin'
        ? 'text-blue-600'
        : 'text-purple-600'
}
function platformBg(t: string) {
  return t === 'instagram'
    ? 'bg-pink-100'
    : t === 'telegram'
      ? 'bg-sky-100'
      : t === 'linkedin'
        ? 'bg-blue-100'
        : 'bg-purple-100'
}

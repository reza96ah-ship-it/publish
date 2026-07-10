import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { inboxService, InboxMessageNotFoundError } from '@/modules/inbox'

const VALID_STATUSES = ['new', 'assigned', 'in_progress', 'resolved'] as const
type InboxStatus = (typeof VALID_STATUSES)[number]

const TRANSITIONS: Record<InboxStatus, InboxStatus[]> = {
  new: ['assigned', 'in_progress', 'resolved'],
  assigned: ['in_progress', 'resolved'],
  in_progress: ['resolved', 'assigned'],
  resolved: ['new'],
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  const next = body?.status as InboxStatus | undefined
  if (!next || !VALID_STATUSES.includes(next)) {
    return NextResponse.json({ error: 'وضعیت نامعتبر' }, { status: 400 })
  }

  try {
    const thread = await inboxService.getThread(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data
    )
    const current = (thread.status as InboxStatus) ?? 'new'
    if (!TRANSITIONS[current].includes(next)) {
      return NextResponse.json({ error: 'انتقال وضعیت مجاز نیست' }, { status: 422 })
    }

    const result = await inboxService.setThreadStatus(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      next
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof InboxMessageNotFoundError)
      return NextResponse.json({ error: 'مورد یافت نشد' }, { status: 404 })
    throw err
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { inboxService, InboxMessageNotFoundError } from '@/modules/inbox'

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('inbox.assign')
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  const priority = typeof body?.priority === 'string' ? body.priority : ''
  if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) {
    return NextResponse.json({ error: 'اولویت نامعتبر' }, { status: 400 })
  }

  try {
    const result = await inboxService.updateThreadPriority(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      { priority }
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof InboxMessageNotFoundError)
      return NextResponse.json({ error: 'مورد یافت نشد' }, { status: 404 })
    throw err
  }
}

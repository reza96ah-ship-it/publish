import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, inboxAssignSchema, validateId } from '@/lib/validations'
import { inboxService, InboxMessageNotFoundError, AssigneeMemberNotFoundError } from '@/modules/inbox'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('inbox.assign')
  if (guard.error) return guard.error

  const body = await req.json().catch(() => ({}))
  const validation = validateBody(inboxAssignSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })

  try {
    const result = await inboxService.assignMessage(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      { assigneeId: validation.data.assigneeId ?? null }
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof InboxMessageNotFoundError) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (err instanceof AssigneeMemberNotFoundError) return NextResponse.json({ error: 'member not found' }, { status: 404 })
    throw err
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import {
  inboxService,
  AssigneeMemberNotFoundError,
  InboxMessageNotFoundError,
} from '@/modules/inbox'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('inbox.assign')
  if (guard.error) return guard.error

  try {
    const result = await inboxService.claimThread(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof InboxMessageNotFoundError)
      return NextResponse.json({ error: 'مورد یافت نشد' }, { status: 404 })
    if (err instanceof AssigneeMemberNotFoundError)
      return NextResponse.json({ error: 'عضو یافت نشد' }, { status: 404 })
    if (err instanceof Error && err.name === 'InboxThreadClaimConflictError') {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    throw err
  }
}

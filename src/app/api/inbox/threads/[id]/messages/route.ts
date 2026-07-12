import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { cursorPaginationSchema, validateId, validateParams } from '@/lib/validations'
import { inboxService, InboxMessageNotFoundError } from '@/modules/inbox'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error

  const queryCheck = validateParams(
    cursorPaginationSchema,
    Object.fromEntries(req.nextUrl.searchParams.entries())
  )
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })

  try {
    const result = await inboxService.listThreadMessages(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      queryCheck.data
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof InboxMessageNotFoundError)
      return NextResponse.json({ error: 'مورد یافت نشد' }, { status: 404 })
    throw err
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { cursorPaginationSchema, validateParams } from '@/lib/validations'
import { inboxService } from '@/modules/inbox'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })

  const result = await inboxService.listThreads(
    { workspaceId: guard.workspaceId, userId: guard.userId },
    queryCheck.data
  )
  return NextResponse.json(result)
}

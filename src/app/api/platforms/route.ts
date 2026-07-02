import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateParams, cursorPaginationSchema } from '@/lib/validations'
import { channelsService } from '@/modules/channels'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('platform.manage')
  if (guard.error) return guard.error

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })

  const result = await channelsService.listPlatforms(
    { workspaceId: guard.workspaceId, userId: guard.userId },
    queryCheck.data
  )
  return NextResponse.json(result)
}

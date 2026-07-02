import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermissionApi } from '@/lib/auth-guards'
import { validateParams, contentListQuerySchema, cursorPaginationSchema } from '@/lib/validations'
import { contentService } from '@/modules/content'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requireAnyPermissionApi(['content.create', 'content.review'])
  if (guard.error) return guard.error

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(contentListQuerySchema.merge(cursorPaginationSchema), query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })

  const result = await contentService.listContent(
    { workspaceId: guard.workspaceId, userId: guard.userId },
    queryCheck.data
  )
  return NextResponse.json(result)
}

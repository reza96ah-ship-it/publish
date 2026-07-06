/**
 * Issue #250: Smart Pages API — click analytics.
 *
 *   GET /api/smart-pages/[id]/clicks — daily click counts for the last 30 days
 *
 * Requires the `analytics.view` permission. Returns an array of
 * { date: 'YYYY-MM-DD', clicks: number } sorted oldest-first.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { smartPagesService, SmartPageError } from '@/modules/smart-pages'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 })
  }

  try {
    const stats = await smartPagesService.getClickStats(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      30
    )
    return NextResponse.json({ data: stats })
  } catch (err) {
    if (err instanceof SmartPageError) {
      return NextResponse.json(
        { error: err.userMessage ?? err.message },
        { status: err.statusCode }
      )
    }
    throw err
  }
}

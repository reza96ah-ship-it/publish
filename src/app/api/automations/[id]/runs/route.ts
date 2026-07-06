/**
 * Issue #249: Automations API — run history.
 *
 *   GET /api/automations/[id]/runs  — cursor-paginated run history for one automation
 *
 * Returns step-level execution detail (trigger, conditions, actions, status,
 * error, timestamps) for the run-history sheet in the admin UI.
 *
 * Requires `workspace.settings`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId, validateParams, cursorPaginationSchema } from '@/lib/validations'
import { automationsService, AutomationError } from '@/modules/automations'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 })
  }

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) {
    return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  }

  try {
    const result = await automationsService.listRuns(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      queryCheck.data
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AutomationError) {
      return NextResponse.json(
        { error: err.userMessage ?? err.message },
        { status: err.statusCode }
      )
    }
    throw err
  }
}

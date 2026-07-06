/**
 * Issue #249: Automations API — list + create.
 *
 *   GET    /api/automations   — list automations in the active workspace
 *   POST   /api/automations   — create a new automation
 *
 * Both require `workspace.settings` (admin-only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import {
  validateBody,
  validateParams,
  cursorPaginationSchema,
  automationCreateSchema,
} from '@/lib/validations'
import { automationsService, AutomationError } from '@/modules/automations'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof AutomationError) {
    return NextResponse.json(
      { error: err.userMessage ?? err.message },
      { status: err.statusCode }
    )
  }
  throw err
}

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) {
    return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  }

  try {
    const result = await automationsService.listAutomations(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      queryCheck.data
    )
    return NextResponse.json(result)
  } catch (err) {
    return mapError(err)
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  const raw = await req.json().catch(() => null)
  if (!raw) {
    return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  }

  const validation = validateBody(automationCreateSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const item = await automationsService.createAutomation(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      validation.data
    )
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    return mapError(err)
  }
}

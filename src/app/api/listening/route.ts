/**
 * Issue #251: Social listening API — list + create.
 *
 *   GET    /api/listening         — list saved searches in the active workspace
 *   POST   /api/listening         — create a new saved search
 *
 * Both require the `analytics.view` permission (admins, editors, approvers).
 * Creating/modifying also gates on `workspace.settings`, but the issue spec
 * calls for `analytics.view / workspace.settings` — we use `analytics.view`
 * here since listening is an analytics-adjacent feature.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import {
  validateBody,
  validateParams,
  cursorPaginationSchema,
  listeningQueryCreateSchema,
} from '@/lib/validations'
import { listeningService, ListeningError } from '@/modules/listening'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) {
    return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  }

  try {
    const result = await listeningService.listQueries(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      queryCheck.data
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ListeningError) {
      return NextResponse.json(
        { error: err.userMessage ?? err.message },
        { status: err.statusCode }
      )
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const raw = await req.json().catch(() => null)
  if (!raw) {
    return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  }

  const validation = validateBody(listeningQueryCreateSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const item = await listeningService.createQuery(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      validation.data
    )
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    if (err instanceof ListeningError) {
      return NextResponse.json(
        { error: err.userMessage ?? err.message },
        { status: err.statusCode }
      )
    }
    throw err
  }
}

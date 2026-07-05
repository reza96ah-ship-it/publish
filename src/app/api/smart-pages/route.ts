/**
 * Issue #250: Smart Pages API — list + create.
 *
 *   GET    /api/smart-pages         — list pages in the active workspace
 *   POST   /api/smart-pages         — create a new page
 *
 * Both require the `workspace.settings` permission (admin-only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import {
  validateBody,
  validateParams,
  cursorPaginationSchema,
  smartPageCreateSchema,
} from '@/lib/validations'
import { smartPagesService, SmartPageError } from '@/modules/smart-pages'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) {
    return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  }

  try {
    const result = await smartPagesService.listSmartPages(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      queryCheck.data
    )
    return NextResponse.json(result)
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

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  const raw = await req.json().catch(() => null)
  if (!raw) {
    return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  }

  const validation = validateBody(smartPageCreateSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const page = await smartPagesService.createSmartPage(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      validation.data
    )
    return NextResponse.json(page, { status: 201 })
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

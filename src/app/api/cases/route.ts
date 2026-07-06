/**
 * Issue #248: Case management API — list + create.
 *
 *   GET    /api/cases   — list cases (filter by status / assigneeId)
 *   POST   /api/cases   — open a new case
 *
 * Permission: workspace.settings OR inbox.reply. Cases are typically opened
 * from the inbox view when a customer issue needs follow-up.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermissionApi } from '@/lib/auth-guards'
import { validateBody, cursorPaginationSchema, caseCreateSchema } from '@/lib/validations'
import { customersService, CustomerError } from '@/modules/customers'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof CustomerError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function GET(req: NextRequest) {
  const guard = await requireAnyPermissionApi(['workspace.settings', 'inbox.reply'])
  if (guard.error) return guard.error
  const q = Object.fromEntries(req.nextUrl.searchParams.entries())
  const params = cursorPaginationSchema.safeParse(q)
  if (!params.success) {
    return NextResponse.json({ error: params.error.issues[0]?.message ?? 'پارامتر نامعتبر' }, { status: 400 })
  }
  const status = typeof q.status === 'string' && q.status.length > 0
    ? (q.status as 'open' | 'in_progress' | 'resolved' | 'closed')
    : undefined
  const assigneeId = typeof q.assigneeId === 'string' && q.assigneeId.length > 0 ? q.assigneeId : undefined
  try {
    const result = await customersService.listCases(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      { ...params.data, status, assigneeId }
    )
    return NextResponse.json(result)
  } catch (err) { return mapError(err) }
}

export async function POST(req: NextRequest) {
  const guard = await requireAnyPermissionApi(['workspace.settings', 'inbox.reply'])
  if (guard.error) return guard.error
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(caseCreateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const caseRow = await customersService.createCase(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      v.data
    )
    return NextResponse.json(caseRow, { status: 201 })
  } catch (err) { return mapError(err) }
}

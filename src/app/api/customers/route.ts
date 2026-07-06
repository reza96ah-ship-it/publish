/**
 * Issue #248: Customer profiles API — list + create.
 *
 *   GET    /api/customers   — list customers (cursor pagination, search, tag filter)
 *   POST   /api/customers   — create a new customer
 *
 * Permission: workspace.settings (admin) OR inbox.reply (editor+). Both
 * roles may need to look up a customer while handling an inbox conversation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermissionApi } from '@/lib/auth-guards'
import {
  validateBody,
  cursorPaginationSchema,
  customerCreateSchema,
} from '@/lib/validations'
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
  const search = typeof q.search === 'string' && q.search.length > 0 ? q.search : undefined
  const tag = typeof q.tag === 'string' && q.tag.length > 0 ? q.tag : undefined
  try {
    const result = await customersService.listCustomers(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      { ...params.data, search, tag }
    )
    return NextResponse.json(result)
  } catch (err) { return mapError(err) }
}

export async function POST(req: NextRequest) {
  const guard = await requireAnyPermissionApi(['workspace.settings', 'inbox.reply'])
  if (guard.error) return guard.error
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(customerCreateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const customer = await customersService.createCustomer(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      v.data
    )
    return NextResponse.json(customer, { status: 201 })
  } catch (err) { return mapError(err) }
}

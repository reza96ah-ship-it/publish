/**
 * Issue #248: Customer profiles API — single-customer CRUD.
 *
 *   GET    /api/customers/[id]   — get a customer with interactions + linked cases
 *   PATCH  /api/customers/[id]  — update a customer
 *   DELETE /api/customers/[id]  — soft-delete a customer (mergedIntoId = self)
 *
 * Next 16: `params` is a Promise. Permission: workspace.settings OR inbox.reply.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId, customerUpdateSchema } from '@/lib/validations'
import { customersService, CustomerError } from '@/modules/customers'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof CustomerError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAnyPermissionApi(['workspace.settings', 'inbox.reply'])
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    return NextResponse.json(
      await customersService.getCustomer({ workspaceId: guard.workspaceId, userId: guard.userId }, idCheck.data)
    )
  } catch (err) { return mapError(err) }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAnyPermissionApi(['workspace.settings', 'inbox.reply'])
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(customerUpdateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const { optOutAt: optOutAtStr, ...rest } = v.data
    const input: Parameters<typeof customersService.updateCustomer>[2] = {
      ...rest,
      ...(optOutAtStr !== undefined ? { optOutAt: optOutAtStr ? new Date(optOutAtStr) : null } : {}),
    }
    return NextResponse.json(
      await customersService.updateCustomer(
        { workspaceId: guard.workspaceId, userId: guard.userId },
        idCheck.data,
        input
      )
    )
  } catch (err) { return mapError(err) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAnyPermissionApi(['workspace.settings', 'inbox.reply'])
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    await customersService.deleteCustomer({ workspaceId: guard.workspaceId, userId: guard.userId }, idCheck.data)
    return new NextResponse(null, { status: 204 })
  } catch (err) { return mapError(err) }
}

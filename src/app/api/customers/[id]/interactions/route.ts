/**
 * Issue #248: Customer interactions API — list + create.
 *
 *   GET    /api/customers/[id]/interactions   — list interactions (newest first)
 *   POST   /api/customers/[id]/interactions   — log a new interaction (manual or auto)
 *
 * Permission: workspace.settings OR inbox.reply. Auto-logged from inbox reply
 * actions; manual logging for offline touchpoints (e.g. a phone call).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId, customerInteractionCreateSchema } from '@/lib/validations'
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
    const interactions = await customersService.listInteractions(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data
    )
    return NextResponse.json({ data: interactions })
  } catch (err) { return mapError(err) }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAnyPermissionApi(['workspace.settings', 'inbox.reply'])
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(customerInteractionCreateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const interaction = await customersService.addInteraction(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      v.data
    )
    return NextResponse.json(interaction, { status: 201 })
  } catch (err) { return mapError(err) }
}

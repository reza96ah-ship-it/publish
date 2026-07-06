/**
 * Issue #248: Customer merge API.
 *
 *   POST /api/customers/[id]/merge   — merge this customer (source) into targetId
 *
 * Re-points all interactions + case participants from source → target, then
 * marks the source as merged (mergedIntoId = targetId). Source row is
 * preserved for audit; list() filters out merged duplicates.
 *
 * Permission: workspace.settings (admin-only — destructive operation).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId, customerMergeSchema } from '@/lib/validations'
import { customersService, CustomerError } from '@/modules/customers'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(customerMergeSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    await customersService.mergeCustomers(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      v.data.targetId
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CustomerError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}

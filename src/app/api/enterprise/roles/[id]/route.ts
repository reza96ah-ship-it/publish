/**
 * Issue #256: Enterprise custom roles API — single-role update + delete.
 *
 *   PATCH   /api/enterprise/roles/[id]   — update a custom role
 *   DELETE  /api/enterprise/roles/[id]  — delete a custom role
 *
 * Next 16: `params` is a Promise. Permission: workspace.settings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId, customRoleUpdateSchema } from '@/lib/validations'
import { enterpriseService, EnterpriseError } from '@/modules/enterprise'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof EnterpriseError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(customRoleUpdateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    return NextResponse.json(
      await enterpriseService.updateCustomRole(
        { workspaceId: guard.workspaceId, userId: guard.userId },
        idCheck.data,
        v.data
      )
    )
  } catch (err) { return mapError(err) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    await enterpriseService.deleteCustomRole({ workspaceId: guard.workspaceId, userId: guard.userId }, idCheck.data)
    return new NextResponse(null, { status: 204 })
  } catch (err) { return mapError(err) }
}

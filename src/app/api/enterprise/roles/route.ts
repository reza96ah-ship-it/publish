/**
 * Issue #256: Enterprise custom roles API — list + create.
 *
 *   GET    /api/enterprise/roles   — list custom roles for the active workspace
 *   POST   /api/enterprise/roles   — create a custom role (name + permissions)
 *
 * Permission: workspace.settings (admin-only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, customRoleCreateSchema } from '@/lib/validations'
import { enterpriseService, EnterpriseError } from '@/modules/enterprise'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof EnterpriseError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function GET() {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  try {
    const list = await enterpriseService.listCustomRoles({ workspaceId: guard.workspaceId, userId: guard.userId })
    return NextResponse.json({ data: list })
  } catch (err) { return mapError(err) }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(customRoleCreateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const role = await enterpriseService.createCustomRole(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      v.data
    )
    return NextResponse.json(role, { status: 201 })
  } catch (err) { return mapError(err) }
}

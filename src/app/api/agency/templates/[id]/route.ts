/**
 * Issue #254: Agency API — single-template PATCH + DELETE.
 *
 *   PATCH   /api/agency/templates/[id]  — update template name/description/config
 *   DELETE  /api/agency/templates/[id]  — delete template
 *
 * Both require `workspace.settings`. Next 16: `params` is a Promise.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId, templateUpdateSchema } from '@/lib/validations'
import { agencyService, AgencyError } from '@/modules/agency'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof AgencyError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(templateUpdateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    return NextResponse.json(
      await agencyService.updateTemplate(
        { workspaceId: guard.workspaceId, userId: guard.userId },
        idCheck.data,
        v.data
      )
    )
  } catch (err) { return mapError(err) }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    await agencyService.deleteTemplate(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data
    )
    return new NextResponse(null, { status: 204 })
  } catch (err) { return mapError(err) }
}

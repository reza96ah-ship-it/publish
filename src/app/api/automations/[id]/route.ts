/**
 * Issue #249: Automations API — single-automation CRUD.
 *
 *   GET    /api/automations/[id]   — get one automation
 *   PATCH  /api/automations/[id]  — update (version-bumps on definition change)
 *   DELETE /api/automations/[id]  — delete
 *
 * All require `workspace.settings`. Next 16: `params` is a Promise.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId, automationUpdateSchema } from '@/lib/validations'
import { automationsService, AutomationError } from '@/modules/automations'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof AutomationError) {
    return NextResponse.json(
      { error: err.userMessage ?? err.message },
      { status: err.statusCode }
    )
  }
  throw err
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    return NextResponse.json(
      await automationsService.getAutomation(
        { workspaceId: guard.workspaceId, userId: guard.userId },
        idCheck.data
      )
    )
  } catch (err) { return mapError(err) }
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
  const validation = validateBody(automationUpdateSchema, raw)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
  try {
    return NextResponse.json(
      await automationsService.updateAutomation(
        { workspaceId: guard.workspaceId, userId: guard.userId },
        idCheck.data,
        validation.data
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
    await automationsService.deleteAutomation(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data
    )
    return new NextResponse(null, { status: 204 })
  } catch (err) { return mapError(err) }
}

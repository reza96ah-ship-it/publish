/**
 * Issue #250: Smart Pages API — single-page CRUD.
 *
 *   GET    /api/smart-pages/[id]   — get a single page (admin view)
 *   PATCH  /api/smart-pages/[id]  — update a page
 *   DELETE /api/smart-pages/[id]  — delete a page
 *
 * All require `workspace.settings`. Next 16: `params` is a Promise.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId, smartPageUpdateSchema } from '@/lib/validations'
import { smartPagesService, SmartPageError } from '@/modules/smart-pages'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof SmartPageError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    return NextResponse.json(await smartPagesService.getSmartPage({ workspaceId: guard.workspaceId, userId: guard.userId }, idCheck.data))
  } catch (err) { return mapError(err) }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const validation = validateBody(smartPageUpdateSchema, raw)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
  try {
    return NextResponse.json(await smartPagesService.updateSmartPage({ workspaceId: guard.workspaceId, userId: guard.userId }, idCheck.data, validation.data))
  } catch (err) { return mapError(err) }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    await smartPagesService.deleteSmartPage({ workspaceId: guard.workspaceId, userId: guard.userId }, idCheck.data)
    return new NextResponse(null, { status: 204 })
  } catch (err) { return mapError(err) }
}

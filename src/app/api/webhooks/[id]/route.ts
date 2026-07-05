/**
 * Issue #255: Webhooks — update + delete.
 *
 *   PATCH   /api/webhooks/[id]  — update url, events, isActive
 *   DELETE  /api/webhooks/[id]  — delete webhook (204)
 *
 * The signing secret cannot be rotated through this route — create a new
 * webhook and delete the old one to rotate. Requires `workspace.settings`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId, webhookUpdateSchema } from '@/lib/validations'
import { webhooksService, WebhookError } from '@/modules/webhooks'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof WebhookError) {
    return NextResponse.json(
      { error: err.userMessage ?? err.message },
      { status: err.statusCode }
    )
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
  const validation = validateBody(webhookUpdateSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    return NextResponse.json(
      await webhooksService.update(guard.workspaceId, idCheck.data, validation.data)
    )
  } catch (err) {
    return mapError(err)
  }
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
    await webhooksService.delete(guard.workspaceId, idCheck.data)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return mapError(err)
  }
}

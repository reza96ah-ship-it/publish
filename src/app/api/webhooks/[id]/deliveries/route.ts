/**
 * Issue #255: Webhooks — recent deliveries (debugging view).
 *
 *   GET /api/webhooks/[id]/deliveries  — last 50 delivery attempts
 *
 * Surfaces the WebhookDelivery outbox so admins can see whether events are
 * being delivered, retry counts, and the last error category. Capped at 50
 * most-recent rows to keep the payload small.
 *
 * Requires `workspace.settings`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { webhooksService, WebhookError } from '@/modules/webhooks'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 })
  }

  try {
    const deliveries = await webhooksService.listDeliveries(
      guard.workspaceId,
      idCheck.data
    )
    return NextResponse.json(deliveries)
  } catch (err) {
    if (err instanceof WebhookError) {
      return NextResponse.json(
        { error: err.userMessage ?? err.message },
        { status: err.statusCode }
      )
    }
    throw err
  }
}

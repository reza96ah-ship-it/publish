/**
 * Issue #255: Webhooks — list + create.
 *
 *   GET    /api/webhooks  — list all webhooks for the workspace
 *   POST   /api/webhooks  — create a new webhook, return signing secret ONCE (201)
 *
 * The HMAC signing secret is returned in the POST response body and never
 * persisted in plaintext — only its encrypted form is stored. Clients must
 * capture it on creation; it's used to verify webhook signatures on the
 * receiver side.
 *
 * Requires `workspace.settings`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, webhookCreateSchema } from '@/lib/validations'
import { webhooksService, WebhookError } from '@/modules/webhooks'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  try {
    const webhooks = await webhooksService.list(guard.workspaceId)
    return NextResponse.json(webhooks)
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

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  const raw = await req.json().catch(() => null)
  if (!raw) {
    return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  }

  const validation = validateBody(webhookCreateSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const result = await webhooksService.create(
      guard.workspaceId,
      guard.userId,
      validation.data
    )
    return NextResponse.json(result, { status: 201 })
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

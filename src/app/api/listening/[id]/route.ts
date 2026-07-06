/**
 * Issue #251: Social listening API — single-query CRUD.
 *
 *   GET    /api/listening/[id]   — get a single saved search
 *   PATCH  /api/listening/[id]   — update a saved search
 *   DELETE /api/listening/[id]   — delete a saved search
 *
 * All require `analytics.view`. Next 16: `params` is a Promise.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId, listeningQueryUpdateSchema } from '@/lib/validations'
import { listeningService, ListeningError } from '@/modules/listening'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof ListeningError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    return NextResponse.json(
      await listeningService.getQuery({ workspaceId: guard.workspaceId, userId: guard.userId }, idCheck.data)
    )
  } catch (err) {
    return mapError(err)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const validation = validateBody(listeningQueryUpdateSchema, raw)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
  try {
    return NextResponse.json(
      await listeningService.updateQuery(
        { workspaceId: guard.workspaceId, userId: guard.userId },
        idCheck.data,
        validation.data
      )
    )
  } catch (err) {
    return mapError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    await listeningService.deleteQuery({ workspaceId: guard.workspaceId, userId: guard.userId }, idCheck.data)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return mapError(err)
  }
}

/**
 * Issue #251: Social listening API — mentions list.
 *
 *   GET /api/listening/[id]/mentions
 *     — cursor-paginated mentions for one saved search
 *     — filters: ?spike=true&sentiment=positive&language=fa
 *
 * Requires `analytics.view`. Next 16: `params` is a Promise.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId, validateParams, listeningMentionsQuerySchema } from '@/lib/validations'
import { listeningService, ListeningError } from '@/modules/listening'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 })
  }

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(listeningMentionsQuerySchema, query)
  if (!queryCheck.success) {
    return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  }

  try {
    const result = await listeningService.listMentions(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      queryCheck.data
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ListeningError) {
      return NextResponse.json(
        { error: err.userMessage ?? err.message },
        { status: err.statusCode }
      )
    }
    throw err
  }
}

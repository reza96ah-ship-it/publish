/**
 * Issue #251: Social listening API — spike detection trigger.
 *
 *   POST /api/listening/[id]/detect-spike
 *     — runs the rolling-window mean + stddev spike detector
 *     — returns a SpikeAlert summary (mean, stddev, threshold, counts)
 *
 * Requires `analytics.view`. Next 16: `params` is a Promise.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { listeningService, ListeningError } from '@/modules/listening'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 })
  }

  try {
    const result = await listeningService.detectSpike(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data
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

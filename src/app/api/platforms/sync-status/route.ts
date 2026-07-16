/**
 * GET /api/platforms/sync-status?platformId=xxx
 *
 * Returns the most recent InstagramSyncRun for the given platform so the UI
 * can show a progress indicator during the initial sync. Returns 404 when no
 * sync has been started for that platform.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('platform.manage')
  if (guard.error) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const platformId = req.nextUrl.searchParams.get('platformId')
  if (!platformId) return NextResponse.json({ error: 'platformId required' }, { status: 400 })

  const run = await db.instagramSyncRun.findFirst({
    where: { platformId, workspaceId: guard.workspaceId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      currentStep: true,
      currentStepIndex: true,
      importedMediaCount: true,
      importedConversationCount: true,
      warnings: true,
      errors: true,
      startedAt: true,
      completedAt: true,
    },
  })

  if (!run) return NextResponse.json({ run: null }, { status: 200 })
  return NextResponse.json({ run })
}

/**
 * GET /api/platforms/sync-status?platformId=xxx
 *
 * Returns the most recent InstagramSyncRun for the given platform so the UI
 * can show a progress indicator during the initial sync. Returns a null run
 * when no sync has been started for that platform.
 */

import { after, NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { queueZernioInitialSync, runZernioInitialSync, zernioSyncCanResume } from '@/modules/instagram-sync/zernio-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const platformId = req.nextUrl.searchParams.get('platformId')
  if (!platformId) return NextResponse.json({ error: 'platformId required' }, { status: 400 })
  const zernioOnly = req.nextUrl.searchParams.get('source') === 'zernio'

  const run = await db.instagramSyncRun.findFirst({
    where: {
      platformId,
      workspaceId: guard.workspaceId,
      ...(zernioOnly ? { checkpoint: { path: ['provider'], equals: 'zernio' } } : {}),
    },
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
      updatedAt: true,
      checkpoint: true,
    },
  })

  if (!run) return NextResponse.json({ run: null }, { status: 200 })
  const checkpoint = run.checkpoint
  const isZernio = !!checkpoint && typeof checkpoint === 'object' && !Array.isArray(checkpoint) &&
    'provider' in checkpoint && checkpoint.provider === 'zernio'
  return NextResponse.json({
    run: {
      ...run,
      checkpoint: undefined,
      canResume: isZernio && zernioSyncCanResume(run.status, run.updatedAt),
    },
  })
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('platform.manage')
  if (guard.error) return guard.error
  const body: unknown = await req.json().catch(() => null)
  const platformId = body && typeof body === 'object' && 'platformId' in body && typeof body.platformId === 'string'
    ? body.platformId : null
  if (!platformId) return NextResponse.json({ error: 'platformId required' }, { status: 400 })

  const platform = await db.platform.findFirst({
    where: { id: platformId, workspaceId: guard.workspaceId, provider: 'zernio', type: 'instagram', status: 'active' },
    select: { id: true },
  })
  if (!platform) return NextResponse.json({ error: 'platform_not_found' }, { status: 404 })

  const runId = await queueZernioInitialSync(platform.id, guard.workspaceId)
  if (runId) after(() => runZernioInitialSync(runId))
  return NextResponse.json({ runId, scheduled: runId !== null })
}

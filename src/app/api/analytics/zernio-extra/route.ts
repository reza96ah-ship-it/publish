import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { logger } from '@/lib/logger'
import { getWorkspaceZernioExtra } from '@/modules/analytics/zernio-extra'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error
  try {
    return NextResponse.json({ accounts: await getWorkspaceZernioExtra(guard.workspaceId) })
  } catch (error) {
    logger.warn({ msg: 'Zernio extended analytics unavailable', code: error instanceof Error ? error.name : 'internal_error' })
    return NextResponse.json({ accounts: [] })
  }
}

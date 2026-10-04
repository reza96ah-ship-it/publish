import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { logger } from '@/lib/logger'
import { getZernioAccountHealth, ZernioApiError } from '@/lib/zernio'
import { listOwnedWorkspaceZernioInstagram } from '@/modules/channels/zernio-sync'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params
  if (!/^[a-f\d]{24}$/i.test(accountId)) {
    return NextResponse.json({ error: 'invalid_account_id' }, { status: 400 })
  }

  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  try {
    const connection = await listOwnedWorkspaceZernioInstagram(guard.workspaceId)
    if (!connection?.accounts.some((account) => account.id === accountId && account.isActive)) {
      return NextResponse.json({ error: 'account_not_found' }, { status: 404 })
    }
    return NextResponse.json({ health: await getZernioAccountHealth(accountId) })
  } catch (error) {
    logger.warn({ msg: 'Zernio Instagram health unavailable', code: error instanceof ZernioApiError ? error.code : 'internal_error' })
    return NextResponse.json({ error: 'health_unavailable' }, { status: 502 })
  }
}

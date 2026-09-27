import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { listInstagramAccounts, ZernioApiError } from '@/lib/zernio'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('platform.manage')
  if (guard.error) return guard.error

  const workspace = await db.workspace.findUnique({
    where: { id: guard.workspaceId },
    select: { zernioProfileId: true },
  })
  if (!workspace?.zernioProfileId) return NextResponse.json({ accounts: [] })

  try {
    const accounts = await listInstagramAccounts(workspace.zernioProfileId)
    // Keep Instagram's CDN URL server-side; browsers in filtered regions use
    // our authenticated, same-origin photo route instead.
    return NextResponse.json({
      accounts: accounts.map((account) => ({
        ...account,
        avatarUrl: account.avatarUrl
          ? `/api/platforms/zernio/instagram/accounts/${account.id}/photo`
          : null,
      })),
    })
  } catch (error) {
    logger.error({ msg: 'Zernio Instagram account list failed', code: error instanceof ZernioApiError ? error.code : 'internal_error' })
    return NextResponse.json({ error: 'zernio_unavailable' }, { status: 502 })
  }
}

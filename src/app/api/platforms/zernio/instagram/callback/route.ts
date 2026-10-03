import { after, NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { listInstagramAccounts, ZernioApiError } from '@/lib/zernio'
import { syncWorkspaceZernioInstagram } from '@/modules/channels/zernio-sync'
import { queueZernioInitialSyncForAccount, runZernioInitialSync } from '@/modules/instagram-sync/zernio-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
const OBJECT_ID = /^[a-f\d]{24}$/i
const FLOW_ID = /^[a-f\d]{32}$/i

function finish(code: string, cookieName?: string): NextResponse {
  const response = NextResponse.redirect(new URL(`/channels?${code}`, BASE_URL))
  if (cookieName) response.cookies.set(cookieName, '', {
    path: '/api/platforms/zernio/instagram',
    maxAge: 0,
  })
  return response
}

export async function GET(request: NextRequest) {
  const guard = await requirePermissionApi('platform.connect')
  if (guard.error) return finish('zernio_error=auth_failed')

  const flow = request.nextUrl.searchParams.get('flow')
  if (!flow || !FLOW_ID.test(flow)) return finish('zernio_error=invalid_flow')
  const cookieName = `zernio_ig_${flow}`
  const cookie = request.cookies.get(cookieName)?.value
  if (!cookie) return finish('zernio_error=expired_flow', cookieName)

  let saved: { workspaceId?: string; userId?: string; profileId?: string }
  try {
    saved = JSON.parse(cookie)
  } catch {
    return finish('zernio_error=invalid_flow', cookieName)
  }
  if (saved.workspaceId !== guard.workspaceId || saved.userId !== guard.userId || !saved.profileId) {
    return finish('zernio_error=invalid_flow', cookieName)
  }

  if (request.nextUrl.searchParams.has('error')) {
    return finish('zernio_error=authorization_failed', cookieName)
  }
  const params = request.nextUrl.searchParams
  const profileId = params.get('profileId')
  const accountId = params.get('accountId')
  if (params.get('connected') !== 'instagram' ||
      !profileId || !accountId ||
      !OBJECT_ID.test(profileId) || !OBJECT_ID.test(accountId) ||
      profileId !== saved.profileId) {
    return finish('zernio_error=invalid_callback', cookieName)
  }

  try {
    const workspace = await db.workspace.findUnique({
      where: { id: guard.workspaceId },
      select: { zernioProfileId: true },
    })
    if (workspace?.zernioProfileId !== profileId) {
      return finish('zernio_error=invalid_profile', cookieName)
    }

    // Callback query parameters are untrusted. Confirm the account and its
    // workspace-scoped profile using the server-side Zernio API key.
    const accounts = await listInstagramAccounts(profileId)
    const account = accounts.find((item) => item.id === accountId && item.isActive)
    if (!account) return finish('zernio_error=account_not_verified', cookieName)

    await syncWorkspaceZernioInstagram(guard.workspaceId)

    try {
      const runId = await queueZernioInitialSyncForAccount(accountId, guard.workspaceId)
      if (runId) after(() => runZernioInitialSync(runId))
    } catch (error) {
      // The connection is valid even if its optional first-data import cannot start.
      logger.error({ msg: 'Zernio initial sync could not be queued', code: error instanceof Error ? error.name : 'internal_error' })
    }

    await db.auditLog.create({
      data: {
        userId: guard.userId,
        workspaceId: guard.workspaceId,
        action: 'platform.zernio_instagram_connected',
        resource: 'Workspace',
        metadata: { profileId, accountId, username: account.username },
      },
    }).catch(() => undefined)

    return finish('zernio_success=1', cookieName)
  } catch (error) {
    logger.error({ msg: 'Zernio Instagram callback verification failed', code: error instanceof ZernioApiError ? error.code : 'internal_error' })
    return finish('zernio_error=verification_failed', cookieName)
  }
}

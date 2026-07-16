/**
 * GET /api/platforms/oauth/callback?code=xxx&state=xxx
 *
 * OAuth callback handler. The service (src/modules/oauth/service.ts) reads the
 * state cookie, exchanges the authorization code for tokens, persists them,
 * and returns the final redirect URL. This handler applies the redirect and
 * clears the state cookie. (Issue #200: thin handler.)
 */

import { after, NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { oauthService } from '@/modules/oauth'
import { backfillInstagramConversations } from '@/modules/inbox/instagram-backfill'
import { startInstagramSync, runInstagramSync } from '@/modules/instagram-sync/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('platform.connect')
  if (guard.error) {
    return NextResponse.redirect(new URL('/channels?oauth_error=auth_failed', BASE_URL))
  }

  const state = req.nextUrl.searchParams.get('state')
  // The state cookie is named after the state token — read it here so the
  // service stays transport-agnostic.
  const cookieName = state ? `oauth_state_${state}` : ''
  const cookieValue = cookieName ? req.cookies.get(cookieName)?.value : undefined

  const result = await oauthService.handleCallback({
    workspaceId: guard.workspaceId,
    userId: guard.userId,
    code: req.nextUrl.searchParams.get('code'),
    state,
    providerError: req.nextUrl.searchParams.get('error'),
    providerErrorDescription: req.nextUrl.searchParams.get('error_description'),
    cookieValue,
    baseUrl: BASE_URL,
  })

  const response = NextResponse.redirect(new URL(result.redirectUrl, BASE_URL))
  if (result.clearCookieName) response.cookies.delete(result.clearCookieName)

  if (result.inboxBackfillPlatformId) {
    const platformId = result.inboxBackfillPlatformId
    after(async () => {
      await backfillInstagramConversations(platformId)
    })
  }

  if (result.initialSyncPlatformId && result.initialSyncWorkspaceId) {
    const platformId = result.initialSyncPlatformId
    const workspaceId = result.initialSyncWorkspaceId
    after(async () => {
      const runId = await startInstagramSync(platformId, workspaceId)
      await runInstagramSync(runId)
    })
  }

  return response
}

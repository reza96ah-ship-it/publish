import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { logger } from '@/lib/logger'
import {
  getInstagramAccountInsights,
  getInstagramRecentPosts,
  ZernioApiError,
} from '@/lib/zernio'
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
    const account = connection?.accounts.find((item) => item.id === accountId && item.isActive)
    if (!account) return NextResponse.json({ error: 'account_not_found' }, { status: 404 })

    const [insights, posts] = await Promise.allSettled([
      getInstagramAccountInsights(accountId),
      getInstagramRecentPosts(accountId),
    ])

    if (insights.status === 'rejected') {
      logger.warn({ msg: 'Zernio Instagram insights unavailable', code: insights.reason instanceof ZernioApiError ? insights.reason.code : 'internal_error' })
    }
    if (posts.status === 'rejected') {
      logger.warn({ msg: 'Zernio Instagram posts unavailable', code: posts.reason instanceof ZernioApiError ? posts.reason.code : 'internal_error' })
    }

    return NextResponse.json({
      insights: insights.status === 'fulfilled' ? insights.value : null,
      insightsStatus: insights.status === 'fulfilled'
        ? 'available'
        : insights.reason instanceof ZernioApiError && insights.reason.status === 402
          ? 'upgrade_required'
          : 'unavailable',
      recentPosts: posts.status === 'fulfilled' ? posts.value : [],
      postsStatus: posts.status === 'fulfilled' ? 'available' : 'unavailable',
    })
  } catch (error) {
    logger.error({ msg: 'Zernio Instagram overview failed', code: error instanceof ZernioApiError ? error.code : 'internal_error' })
    return NextResponse.json({ error: 'zernio_unavailable' }, { status: 502 })
  }
}

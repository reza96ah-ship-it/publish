import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { createZernioProfile, getInstagramConnectUrl, ZernioApiError } from '@/lib/zernio'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
const COOKIE_TTL = 15 * 60

function failure(code: string): NextResponse {
  return NextResponse.redirect(new URL(`/channels?zernio_error=${code}`, BASE_URL))
}

export async function GET() {
  const guard = await requirePermissionApi('platform.connect')
  if (guard.error) return failure('auth_failed')

  try {
    const workspace = await db.workspace.findUnique({
      where: { id: guard.workspaceId },
      select: { zernioProfileId: true },
    })
    if (!workspace) return failure('workspace_not_found')

    let profileId = workspace.zernioProfileId
    if (!profileId) {
      profileId = await createZernioProfile(guard.workspaceId)
      await db.workspace.update({
        where: { id: guard.workspaceId },
        data: { zernioProfileId: profileId },
      })
    }

    const flow = randomBytes(16).toString('hex')
    const callback = new URL('/api/platforms/zernio/instagram/callback', BASE_URL)
    callback.searchParams.set('flow', flow)
    const authorizationUrl = await getInstagramConnectUrl(profileId, callback.toString())

    const response = NextResponse.redirect(authorizationUrl)
    response.cookies.set(`zernio_ig_${flow}`, JSON.stringify({
      workspaceId: guard.workspaceId,
      userId: guard.userId,
      profileId,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_TTL,
      path: '/api/platforms/zernio/instagram',
    })
    return response
  } catch (error) {
    logger.error({ msg: 'Zernio Instagram connect start failed', code: error instanceof ZernioApiError ? error.code : 'internal_error' })
    if (error instanceof ZernioApiError && error.code === 'not_configured') return failure('not_configured')
    if (error instanceof ZernioApiError && error.status === 402) return failure('payment_required')
    return failure('start_failed')
  }
}

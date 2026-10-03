import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { listInstagramAccounts, ZernioApiError } from '@/lib/zernio'
import { fetchInstagramPhotoThroughProxy } from '@/lib/zernio-photo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

  const proxyUrl = process.env.INSTAGRAM_IMAGE_PROXY_URL
  if (!proxyUrl) return NextResponse.json({ error: 'image_proxy_not_configured' }, { status: 503 })

  const workspace = await db.workspace.findUnique({
    where: { id: guard.workspaceId },
    select: { zernioProfileId: true },
  })
  if (!workspace?.zernioProfileId) return NextResponse.json({ error: 'account_not_found' }, { status: 404 })

  try {
    const account = (await listInstagramAccounts(workspace.zernioProfileId))
      .find((item) => item.id === accountId)
    if (!account?.avatarUrl) return NextResponse.json({ error: 'photo_not_found' }, { status: 404 })

    const { bytes, contentType } = await fetchInstagramPhotoThroughProxy(account.avatarUrl, proxyUrl)
    const body = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(body).set(bytes)
    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    logger.error({
      msg: 'Zernio Instagram profile photo unavailable',
      code: error instanceof ZernioApiError ? error.code : 'image_fetch_failed',
    })
    return NextResponse.json({ error: 'photo_unavailable' }, { status: 502 })
  }
}

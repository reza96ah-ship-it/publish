import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { validateId } from '@/lib/validations'
import { getZernioInboxConversation, ZernioApiError } from '@/lib/zernio'
import { fetchInstagramPhotoThroughProxy } from '@/lib/zernio-photo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error

  const proxyUrl = process.env.INSTAGRAM_IMAGE_PROXY_URL
  if (!proxyUrl) return NextResponse.json({ error: 'image_proxy_not_configured' }, { status: 503 })

  const thread = await db.inboxThread.findFirst({
    where: { id: idCheck.data, workspaceId: guard.workspaceId },
    select: {
      providerThreadId: true,
      messageType: true,
      platform: { select: { type: true, provider: true, providerAccountId: true } },
    },
  })
  if (
    !thread || thread.messageType !== 'dm' ||
    thread.platform.type !== 'instagram' || thread.platform.provider !== 'zernio' ||
    !thread.platform.providerAccountId
  ) {
    return NextResponse.json({ error: 'photo_not_found' }, { status: 404 })
  }

  try {
    const conversation = await getZernioInboxConversation(
      thread.platform.providerAccountId,
      thread.providerThreadId,
    )
    if (!conversation.participantPicture) {
      return NextResponse.json({ error: 'photo_not_found' }, { status: 404 })
    }

    const { bytes, contentType } = await fetchInstagramPhotoThroughProxy(
      conversation.participantPicture,
      proxyUrl,
    )
    const body = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(body).set(bytes)
    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=900',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    logger.error({
      msg: 'Zernio inbox participant photo unavailable',
      code: error instanceof ZernioApiError ? error.code : 'image_fetch_failed',
    })
    return NextResponse.json({ error: 'photo_unavailable' }, { status: 502 })
  }
}

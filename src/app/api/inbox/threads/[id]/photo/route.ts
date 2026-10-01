import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { validateId } from '@/lib/validations'
import { getZernioInboxConversation, ZernioApiError } from '@/lib/zernio'
import { fetchInstagramPhotoThroughProxy, instagramPhotoTarget } from '@/lib/zernio-photo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function photoResponse(picture: string, proxyUrl: string): Promise<NextResponse> {
  const { bytes, contentType } = await fetchInstagramPhotoThroughProxy(picture, proxyUrl)
  const body = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(body).set(bytes)
  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=900',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function storedAuthorPicture(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const picture = (payload as Record<string, unknown>).authorPicture
  return typeof picture === 'string' && instagramPhotoTarget(picture) ? picture : null
}

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
      id: true,
      platformId: true,
      providerUserId: true,
      providerThreadId: true,
      messageType: true,
      platform: { select: { type: true, provider: true, providerAccountId: true } },
    },
  })
  if (
    !thread || (thread.messageType !== 'dm' && thread.messageType !== 'comment') ||
    thread.platform.type !== 'instagram' || thread.platform.provider !== 'zernio' ||
    !thread.platform.providerAccountId
  ) {
    return NextResponse.json({ error: 'photo_not_found' }, { status: 404 })
  }

  try {
    if (thread.messageType === 'comment') {
      // Never infer identity from a username: only a comment author ID that matches
      // the thread's sender, or an exact same-account DM participant, is trusted.
      if (!thread.providerUserId) return NextResponse.json({ error: 'photo_not_found' }, { status: 404 })
      const messages = await db.inboxThreadMessage.findMany({
        where: { threadId: thread.id, direction: 'inbound', senderExternalId: thread.providerUserId },
        select: { payload: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      for (const message of messages) {
        const picture = storedAuthorPicture(message.payload)
        if (!picture) continue
        try {
          return await photoResponse(picture, proxyUrl)
        } catch {
          // Signed Instagram CDN URLs expire; a matching DM may have a fresh one.
        }
      }
      const dm = await db.inboxThread.findFirst({
        where: {
          workspaceId: guard.workspaceId,
          platformId: thread.platformId,
          providerUserId: thread.providerUserId,
          messageType: 'dm',
        },
        select: { providerThreadId: true },
        orderBy: { updatedAt: 'desc' },
      })
      if (!dm) return NextResponse.json({ error: 'photo_not_found' }, { status: 404 })
      const conversation = await getZernioInboxConversation(thread.platform.providerAccountId, dm.providerThreadId)
      if (conversation.participantId !== thread.providerUserId || !conversation.participantPicture) {
        return NextResponse.json({ error: 'photo_not_found' }, { status: 404 })
      }
      return await photoResponse(conversation.participantPicture, proxyUrl)
    }
    const conversation = await getZernioInboxConversation(
      thread.platform.providerAccountId,
      thread.providerThreadId,
    )
    if (!conversation.participantPicture) return NextResponse.json({ error: 'photo_not_found' }, { status: 404 })
    return await photoResponse(conversation.participantPicture, proxyUrl)
  } catch (error) {
    logger.error({
      msg: 'Zernio inbox participant photo unavailable',
      code: error instanceof ZernioApiError ? error.code : 'image_fetch_failed',
    })
    return NextResponse.json({ error: 'photo_unavailable' }, { status: 502 })
  }
}

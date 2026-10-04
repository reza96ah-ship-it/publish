import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { processZernioWebhookEvent, zernioWebhookAccountId } from '@/modules/inbox/zernio-webhook'

export const dynamic = 'force-dynamic'

function validSignature(rawBody: string, provided: string | null, secret: string): boolean {
  if (!provided || !/^[a-f0-9]{64}$/.test(provided)) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest()
  return timingSafeEqual(expected, Buffer.from(provided, 'hex'))
}

export async function POST(req: NextRequest) {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 })
  const rawBody = await req.text()
  if (rawBody.length > 256_000) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
  const signature = req.headers.get('x-zernio-signature')
  if (!validSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }
  let payload: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(rawBody)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid payload')
    payload = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const eventId = payload.id
  const event = payload.event
  if (typeof eventId !== 'string' || !/^[0-9a-f-]{36}$/i.test(eventId) || req.headers.get('x-zernio-event-id') !== eventId) {
    return NextResponse.json({ error: 'invalid_event_id' }, { status: 400 })
  }
  if (!['message.received', 'message.sent', 'comment.received', 'webhook.test'].includes(String(event))) {
    return NextResponse.json({ ignored: true })
  }
  if (event === 'webhook.test') return NextResponse.json({ ok: true })

  const eventKey = `zernio:${eventId}`
  try {
    await db.providerWebhookEvent.upsert({
      where: { eventKey },
      create: {
        provider: 'zernio', eventKey,
        providerAccountId: zernioWebhookAccountId(payload),
        providerObject: typeof event === 'string' ? event : null,
        payload: payload as Prisma.InputJsonValue,
        rawBody, signature,
        entryCount: 1,
      },
      update: { duplicateCount: { increment: 1 }, lastReceivedAt: new Date() },
    })
    await processZernioWebhookEvent(eventKey)
    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error({ msg: 'Zernio webhook ingest failed', code: error instanceof Error ? error.name : 'internal_error' })
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import {
  summarizeInstagramWebhookPayload,
  verifyInstagramWebhookChallenge,
  verifyInstagramWebhookSignature,
} from '@/modules/inbox/instagram-webhook'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const verification = verifyInstagramWebhookChallenge(req.nextUrl.searchParams)
  if (!verification.ok) {
    return NextResponse.json(
      { error: verification.error },
      { status: verification.status }
    )
  }

  return new NextResponse(verification.challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = verifyInstagramWebhookSignature(
    rawBody,
    req.headers.get('x-hub-signature-256')
  )
  if (!signature.ok) {
    return NextResponse.json({ error: signature.error }, { status: signature.status })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_instagram_webhook_json' }, { status: 400 })
  }

  return NextResponse.json(
    {
      ok: true,
      provider: 'instagram',
      receivedAt: new Date().toISOString(),
      ...summarizeInstagramWebhookPayload(payload),
    },
    { status: 202 }
  )
}

import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({ db: { providerWebhookEvent: { upsert: vi.fn() } } }))
vi.mock('@/modules/inbox/zernio-webhook', () => ({
  processZernioWebhookEvent: vi.fn(),
  zernioWebhookAccountId: vi.fn().mockReturnValue('account-1'),
}))

import { db } from '@/lib/db'
import { processZernioWebhookEvent } from '@/modules/inbox/zernio-webhook'
import { POST } from '@/app/api/webhooks/zernio/route'

const id = '3f0c1c2e-6c4a-4d3e-9b1f-2a7d8e9f0a1b'
const payload = { id, event: 'message.received', account: { accountId: 'account-1' } }

function request(body: string, signature?: string) {
  return new NextRequest('http://localhost/api/webhooks/zernio', {
    method: 'POST',
    headers: {
      'x-zernio-event-id': id,
      'x-zernio-signature': signature ?? createHmac('sha256', 'shared-secret').update(body).digest('hex'),
    },
    body,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('ZERNIO_WEBHOOK_SECRET', 'shared-secret')
  vi.mocked(db.providerWebhookEvent.upsert).mockResolvedValue({} as never)
  vi.mocked(processZernioWebhookEvent).mockResolvedValue(true)
})

describe('Zernio webhook security', () => {
  it('rejects altered bodies before any database write', async () => {
    const body = JSON.stringify(payload)
    const response = await POST(request(body + ' ', createHmac('sha256', 'shared-secret').update(body).digest('hex')))
    expect(response.status).toBe(401)
    expect(db.providerWebhookEvent.upsert).not.toHaveBeenCalled()
  })

  it('persists and processes a verified event using the stable provider id', async () => {
    const response = await POST(request(JSON.stringify(payload)))
    expect(response.status).toBe(200)
    expect(db.providerWebhookEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventKey: `zernio:${id}` },
      create: expect.objectContaining({ provider: 'zernio', eventKey: `zernio:${id}`, providerAccountId: 'account-1' }),
    }))
    expect(processZernioWebhookEvent).toHaveBeenCalledWith(`zernio:${id}`)
  })
})

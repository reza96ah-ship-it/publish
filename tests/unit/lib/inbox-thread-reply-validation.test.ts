import { describe, expect, it } from 'vitest'
import { inboxThreadReplySchema } from '@/lib/validations'

describe('inboxThreadReplySchema', () => {
  it('keeps the existing direct-Meta reply body valid without a key', () => {
    expect(inboxThreadReplySchema.safeParse({ reply: 'Hello' }).success).toBe(true)
  })

  it('accepts a stable Zernio key and rejects malformed keys', () => {
    const reply = 'Hello'
    expect(inboxThreadReplySchema.safeParse({ reply, idempotencyKey: '7b8e1250-4205-4c6e-9270-cba566e716cb' }).success).toBe(true)
    expect(inboxThreadReplySchema.safeParse({ reply, idempotencyKey: 'not-a-uuid' }).success).toBe(false)
  })
})

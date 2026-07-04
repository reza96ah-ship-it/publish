import { describe, it, expect } from 'vitest'
import {
  publishSchema,
  aiCaptionSchema,
  memberInviteSchema,
  rescheduleSchema,
} from '@/lib/validations'

describe('publishSchema', () => {
  it('rejects empty title', () => {
    const r = publishSchema.safeParse({ title: '' })
    expect(r.success).toBe(false)
  })

  it('accepts valid title', () => {
    const r = publishSchema.safeParse({ title: 'test' })
    expect(r.success).toBe(true)
  })
})

describe('aiCaptionSchema', () => {
  it('rejects topic shorter than 3 chars', () => {
    const r = aiCaptionSchema.safeParse({ topic: 'ab', platform: 'instagram' })
    expect(r.success).toBe(false)
  })
})

describe('memberInviteSchema', () => {
  it('rejects invalid email', () => {
    const r = memberInviteSchema.safeParse({ email: 'bad' })
    expect(r.success).toBe(false)
  })
})

describe('rescheduleSchema', () => {
  it('rejects invalid scheduledAt string', () => {
    const r = rescheduleSchema.safeParse({ action: 'reschedule', scheduledAt: 'invalid' })
    expect(r.success).toBe(false)
  })

  it('accepts future ISO scheduledAt', () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    const r = rescheduleSchema.safeParse({ action: 'reschedule', scheduledAt: future })
    expect(r.success).toBe(true)
  })
})

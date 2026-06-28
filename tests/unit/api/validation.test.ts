import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateBody,
  validateParams,
  validateId,
  publishSchema,
  aiCaptionSchema,
  memberInviteSchema,
  rescheduleSchema,
  cursorPaginationSchema,
} from '@/lib/validations'

describe('API Validation — publishSchema', () => {
  it('rejects empty title', () => {
    const r = validateBody(publishSchema, { title: '' })
    expect(r.success).toBe(false)
  })

  it('accepts valid publish payload', () => {
    const r = validateBody(publishSchema, {
      title: '测试标题',
      channelIds: ['550e8400-e29b-41d4-a716-446655440000'],
      scheduleMode: 'now',
    })
    expect(r.success).toBe(true)
  })

  it('rejects non-UUID channel id', () => {
    const r = validateBody(publishSchema, {
      title: 'test',
      channelIds: ['not-a-valid-uuid'],
    })
    expect(r.success).toBe(false)
  })

  it('rejects invalid scheduleMode', () => {
    const r = validateBody(publishSchema, {
      title: 'test',
      scheduleMode: 'invalid',
    })
    expect(r.success).toBe(false)
  })
})

describe('API Validation — aiCaptionSchema', () => {
  it('rejects topic shorter than 3 chars', () => {
    const r = validateBody(aiCaptionSchema, { topic: 'ab', platform: 'instagram' })
    expect(r.success).toBe(false)
  })

  it('accepts valid caption request', () => {
    const r = validateBody(aiCaptionSchema, {
      topic: 'قهوه صبحگاهی',
      platform: 'telegram',
      tone: 'friendly',
    })
    expect(r.success).toBe(true)
  })

  it('rejects invalid platform', () => {
    const r = validateBody(aiCaptionSchema, { topic: 'test', platform: 'facebook' })
    expect(r.success).toBe(false)
  })
})

describe('API Validation — memberInviteSchema', () => {
  it('rejects invalid email', () => {
    const r = validateBody(memberInviteSchema, { email: 'bad' })
    expect(r.success).toBe(false)
  })

  it('accepts valid invite', () => {
    const r = validateBody(memberInviteSchema, {
      email: 'user@example.com',
      role: 'editor',
    })
    expect(r.success).toBe(true)
  })

  it('rejects invalid role', () => {
    const r = validateBody(memberInviteSchema, {
      email: 'user@example.com',
      role: 'superadmin',
    })
    expect(r.success).toBe(false)
  })
})

describe('API Validation — rescheduleSchema', () => {
  it('rejects invalid date string', () => {
    const r = validateBody(rescheduleSchema, { action: 'reschedule', scheduledAt: 'invalid' })
    expect(r.success).toBe(false)
  })

  it('rejects past date', () => {
    const r = validateBody(rescheduleSchema, {
      action: 'reschedule',
      scheduledAt: '2020-01-01T00:00:00Z',
    })
    expect(r.success).toBe(false)
  })

  it('accepts future date', () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    const r = validateBody(rescheduleSchema, { action: 'reschedule', scheduledAt: future })
    expect(r.success).toBe(true)
  })
})

describe('API Validation — cursorPaginationSchema', () => {
  it('accepts empty params (defaults)', () => {
    const r = validateParams(cursorPaginationSchema, {})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.limit).toBe(20)
      expect(r.data.cursor).toBeUndefined()
    }
  })

  it('accepts cursor + limit', () => {
    const r = validateParams(cursorPaginationSchema, { cursor: 'abc123', limit: '50' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.cursor).toBe('abc123')
      expect(r.data.limit).toBe(50)
    }
  })

  it('rejects limit > 100', () => {
    const r = validateParams(cursorPaginationSchema, { limit: '200' })
    expect(r.success).toBe(false)
  })
})

describe('API Validation — validateId', () => {
  it('rejects empty string', () => {
    const r = validateId('')
    expect(r.success).toBe(false)
  })

  it('accepts valid ID', () => {
    const r = validateId('cm123456')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe('cm123456')
  })
})

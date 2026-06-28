import { describe, it, expect } from 'vitest'
import {
  validateBody,
  validateParams,
  validateId,
  publishSchema,
  aiCaptionSchema,
  memberInviteSchema,
  cursorPaginationSchema,
} from '../../../src/lib/validations'
import { z } from 'zod'

describe('God-node: validateBody()', () => {
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  })

  it('returns success with valid data', () => {
    const result = validateBody(testSchema, { name: 'ali', age: 30 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('ali')
      expect(result.data.age).toBe(30)
    }
  })

  it('returns failure with missing required field', () => {
    const result = validateBody(testSchema, { age: 30 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeTruthy()
    }
  })

  it('returns failure with invalid type', () => {
    const result = validateBody(testSchema, { name: 'ali', age: -5 })
    expect(result.success).toBe(false)
  })

  it('returns failure with null', () => {
    const result = validateBody(testSchema, null)
    expect(result.success).toBe(false)
  })

  it('returns failure with undefined', () => {
    const result = validateBody(testSchema, undefined)
    expect(result.success).toBe(false)
  })

  it('returns failure with empty object', () => {
    const result = validateBody(testSchema, {})
    expect(result.success).toBe(false)
  })

  it('returns the first error message in Persian when available', () => {
    const persianSchema = z.object({
      title: z.string().min(1, 'عنوان الزامی است'),
    })
    const result = validateBody(persianSchema, { title: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('عنوان الزامی است')
    }
  })
})

describe('God-node: validateParams()', () => {
  const paramSchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })

  it('parses string params to numbers', () => {
    const result = validateParams(paramSchema, { page: '2', limit: '50' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(2)
      expect(result.data.limit).toBe(50)
    }
  })

  it('accepts empty params (all optional)', () => {
    const result = validateParams(paramSchema, {})
    expect(result.success).toBe(true)
  })

  it('rejects limit > 100', () => {
    const result = validateParams(paramSchema, { limit: '200' })
    expect(result.success).toBe(false)
  })

  it('rejects page < 1', () => {
    const result = validateParams(paramSchema, { page: '0' })
    expect(result.success).toBe(false)
  })
})

describe('God-node: validateId()', () => {
  it('accepts valid ID', () => {
    const result = validateId('cm123456')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('cm123456')
  })

  it('rejects empty string', () => {
    const result = validateId('')
    expect(result.success).toBe(false)
  })

  it('rejects very long string (> 100 chars)', () => {
    const result = validateId('a'.repeat(101))
    expect(result.success).toBe(false)
  })
})

describe('God-node: publishSchema integration', () => {
  it('accepts valid publish payload', () => {
    const result = validateBody(publishSchema, {
      title: 'تست انتشار',
      platformTypes: ['telegram'],
      scheduleMode: 'now',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = validateBody(publishSchema, { title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid platform type', () => {
    const result = validateBody(publishSchema, {
      title: 'test',
      platformTypes: ['facebook'],
    })
    expect(result.success).toBe(false)
  })
})

describe('God-node: cursorPaginationSchema integration', () => {
  it('defaults limit to 20', () => {
    const result = validateParams(cursorPaginationSchema, {})
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(20)
  })

  it('accepts cursor + limit', () => {
    const result = validateParams(cursorPaginationSchema, { cursor: 'abc', limit: '50' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cursor).toBe('abc')
      expect(result.data.limit).toBe(50)
    }
  })
})

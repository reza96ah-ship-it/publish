import { describe, it, expect } from 'vitest'
import {
  PublicationError,
  ValidationError,
  PermissionDeniedError,
  NoChannelsError,
  ChannelsNotFoundError,
  InvalidBodyError,
} from '../../../src/modules/publications/errors'

describe('Issue #124/#125 — Publications domain errors map to correct HTTP statuses', () => {
  it('ValidationError → 400', () => {
    const err = new ValidationError('فیلد الزامی است')
    expect(err.statusCode).toBe(400)
    expect(err.userMessage).toBe('فیلد الزامی است')
    expect(err.name).toBe('ValidationError')
  })

  it('PermissionDeniedError → 403', () => {
    const err = new PermissionDeniedError()
    expect(err.statusCode).toBe(403)
    expect(err.userMessage).toContain('دسترسی')
  })

  it('NoChannelsError → 400', () => {
    const err = new NoChannelsError()
    expect(err.statusCode).toBe(400)
    expect(err.userMessage).toContain('کانال')
  })

  it('ChannelsNotFoundError → 400', () => {
    const err = new ChannelsNotFoundError()
    expect(err.statusCode).toBe(400)
    expect(err.userMessage).toContain('یافت نشد')
  })

  it('InvalidBodyError → 400', () => {
    const err = new InvalidBodyError()
    expect(err.statusCode).toBe(400)
  })

  it('PublicationError base class carries custom status + message', () => {
    const err = new PublicationError('custom', 422, 'متن سفارشی')
    expect(err.statusCode).toBe(422)
    expect(err.message).toBe('custom')
    expect(err.userMessage).toBe('متن سفارشی')
  })

  it('all errors are instanceof PublicationError (route handler catches base class)', () => {
    expect(new ValidationError('x')).toBeInstanceOf(PublicationError)
    expect(new PermissionDeniedError()).toBeInstanceOf(PublicationError)
    expect(new NoChannelsError()).toBeInstanceOf(PublicationError)
    expect(new ChannelsNotFoundError()).toBeInstanceOf(PublicationError)
    expect(new InvalidBodyError()).toBeInstanceOf(PublicationError)
  })
})

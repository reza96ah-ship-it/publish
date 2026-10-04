import { describe, expect, it } from 'vitest'
import { isStrongAppPassword } from '@/lib/password-policy'

describe('app password policy', () => {
  it('accepts a long passphrase', () => {
    expect(isStrongAppPassword('fresh-mountain-river-2026', 'owner@example.com')).toBe(true)
  })

  it.each(['adminadminadmin', 'aaaaaaaaaaaa', 'password-123456', 'qwerty-forest-2026', 'short'])('rejects weak input', (password) => {
    expect(isStrongAppPassword(password, 'owner@example.com')).toBe(false)
  })

  it('rejects the email and local part', () => {
    expect(isStrongAppPassword('owner@example.com-long', 'owner@example.com')).toBe(false)
    expect(isStrongAppPassword('owner-mountain-2026', 'owner@example.com')).toBe(false)
  })
})

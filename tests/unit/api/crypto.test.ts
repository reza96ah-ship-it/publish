import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, isEncrypted, ensureEncrypted } from '../../../src/lib/crypto'

describe('Crypto — AES-256-GCM token encryption', () => {
  it('encrypts and decrypts round-trip', () => {
    const plaintext = 'bot123456789:ABCdefGHIjklMNOpqrSTUvwxYZ'
    const encrypted = encrypt(plaintext)
    
    expect(isEncrypted(encrypted)).toBe(true)
    expect(encrypted).not.toBe(plaintext)
    expect(encrypted.startsWith('enc:v1:')).toBe(true)
    
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('decrypt handles plaintext (backward compat)', () => {
    const plaintext = 'old-plaintext-token'
    expect(isEncrypted(plaintext)).toBe(false)
    
    // decrypt should return plaintext as-is if not encrypted
    const result = decrypt(plaintext)
    expect(result).toBe(plaintext)
  })

  it('ensureEncrypted is idempotent', () => {
    const plaintext = 'token123'
    const encrypted = ensureEncrypted(plaintext)
    expect(isEncrypted(encrypted)).toBe(true)
    
    // Second call should not re-encrypt
    const doubleEncrypted = ensureEncrypted(encrypted)
    expect(doubleEncrypted).toBe(encrypted)
  })

  it('different encryptions produce different ciphertexts (random IV)', () => {
    const plaintext = 'same-token'
    const enc1 = encrypt(plaintext)
    const enc2 = encrypt(plaintext)
    
    expect(enc1).not.toBe(enc2)
    expect(decrypt(enc1)).toBe(plaintext)
    expect(decrypt(enc2)).toBe(plaintext)
  })

  it('handles empty string', () => {
    const encrypted = encrypt('')
    expect(isEncrypted(encrypted)).toBe(true)
    expect(decrypt(encrypted)).toBe('')
  })

  it('handles unicode/Persian text', () => {
    const persian = 'توکن ربات تلگرام: ۱۲۳۴۵۶۷۸۹'
    const encrypted = encrypt(persian)
    expect(decrypt(encrypted)).toBe(persian)
  })
})

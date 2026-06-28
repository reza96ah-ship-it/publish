import { describe, it, expect } from 'vitest'
import { validateMagicBytes } from '@/lib/storage'

describe('Storage — magic byte validation', () => {
  it('validates JPEG magic bytes', () => {
    const buffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ])
    const result = validateMagicBytes(buffer)
    expect(result.valid).toBe(true)
    expect(result.type).toBe('jpeg')
  })

  it('validates PNG magic bytes', () => {
    const buffer = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      0x00,
      0x00,
      0x00,
      0x0d,
      0x49,
      0x48,
      0x44,
      0x52,
      0x00,
      0x00,
      0x01,
      0x90, // width = 400
      0x00,
      0x00,
      0x01,
      0x90, // height = 400
    ])
    const result = validateMagicBytes(buffer)
    expect(result.valid).toBe(true)
    expect(result.type).toBe('png')
    expect(result.width).toBe(400)
    expect(result.height).toBe(400)
  })

  it('validates WebP magic bytes', () => {
    const buffer = Buffer.from([
      0x52,
      0x49,
      0x46,
      0x46, // RIFF
      0x00,
      0x00,
      0x00,
      0x00, // file size
      0x57,
      0x45,
      0x42,
      0x50, // WEBP
    ])
    const result = validateMagicBytes(buffer)
    expect(result.valid).toBe(true)
    expect(result.type).toBe('webp')
  })

  it('validates GIF magic bytes', () => {
    const buffer = Buffer.from([
      0x47,
      0x49,
      0x46,
      0x38,
      0x39,
      0x61, // GIF89a
      0x90,
      0x01, // width = 400 (little-endian)
      0x90,
      0x01, // height = 400
      0x00,
      0x00, // padding to reach 12 bytes
    ])
    const result = validateMagicBytes(buffer)
    expect(result.valid).toBe(true)
    expect(result.type).toBe('gif')
    expect(result.width).toBe(400)
    expect(result.height).toBe(400)
  })

  it('rejects invalid file (exe renamed to jpg)', () => {
    const buffer = Buffer.from([
      0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
    ])
    const result = validateMagicBytes(buffer)
    expect(result.valid).toBe(false)
    expect(result.type).toBeNull()
  })

  it('rejects too-short buffer', () => {
    const buffer = Buffer.from([0xff, 0xd8])
    const result = validateMagicBytes(buffer)
    expect(result.valid).toBe(false)
    expect(result.type).toBeNull()
  })

  it('rejects random data', () => {
    const buffer = Buffer.from([
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
    ])
    const result = validateMagicBytes(buffer)
    expect(result.valid).toBe(false)
    expect(result.type).toBeNull()
  })
})

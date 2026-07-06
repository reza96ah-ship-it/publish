import { describe, it, expect } from 'vitest'
import { validateMagicBytes, isValidStorageKey, buildStorageKey, buildDerivedKey } from '@/lib/storage'

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

  // Issue #146: video signature support — 'ftyp' box at byte offset 4 (ISO base media)
  it('validates MP4 magic bytes', () => {
    const buffer = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ])
    const result = validateMagicBytes(buffer)
    expect(result.valid).toBe(true)
    expect(result.type).toBe('mp4')
    expect(result.kind).toBe('video')
  })

  it('validates MOV (QuickTime) magic bytes', () => {
    const buffer = Buffer.from([
      0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20,
    ])
    const result = validateMagicBytes(buffer)
    expect(result.valid).toBe(true)
    expect(result.type).toBe('mov')
    expect(result.kind).toBe('video')
  })

  it('validates WebM (EBML header) magic bytes', () => {
    const buffer = Buffer.from([
      0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x23,
    ])
    const result = validateMagicBytes(buffer)
    expect(result.valid).toBe(true)
    expect(result.type).toBe('webm')
    expect(result.kind).toBe('video')
  })

  it('reports kind=image for image formats', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(validateMagicBytes(jpeg).kind).toBe('image')
  })
})

describe('Storage — server-owned key generation', () => {
  it('builds a key under the workspace prefix with a uuid + extension', () => {
    const key = buildStorageKey('ws_123', 'image/png')
    expect(key).toMatch(/^ws_123\/[0-9a-f-]{36}\.png$/)
  })

  it('derives an extension from the declared content-type, not client input', () => {
    expect(buildStorageKey('ws_1', 'video/mp4')).toMatch(/\.mp4$/)
    expect(buildStorageKey('ws_1', 'video/quicktime')).toMatch(/\.mov$/)
    expect(buildStorageKey('ws_1', 'video/webm')).toMatch(/\.webm$/)
  })
})

describe('Storage — key validation (anti path-traversal / anti-spoofing)', () => {
  it('accepts a key matching the server-generated shape for its own workspace', () => {
    const key = buildStorageKey('ws_abc', 'image/jpeg')
    expect(isValidStorageKey(key, 'ws_abc')).toBe(true)
  })

  it('rejects a key belonging to a different workspace', () => {
    const key = buildStorageKey('ws_abc', 'image/jpeg')
    expect(isValidStorageKey(key, 'ws_other')).toBe(false)
  })

  it('rejects path traversal attempts', () => {
    expect(isValidStorageKey('../../../etc/passwd', 'ws_abc')).toBe(false)
    expect(isValidStorageKey('ws_abc/../../../etc/passwd', 'ws_abc')).toBe(false)
  })

  it('rejects a key that does not match the uuid shape (not server-issued)', () => {
    expect(isValidStorageKey('ws_abc/not-a-real-uuid.png', 'ws_abc')).toBe(false)
  })
})

describe('Storage — derived asset keys', () => {
  it('builds a thumbnail key alongside the original, same directory', () => {
    const original = 'ws_1/abc-123.png'
    const thumb = buildDerivedKey(original, 'thumb.webp')
    expect(thumb).toBe('ws_1/abc-123.thumb.webp')
  })
})

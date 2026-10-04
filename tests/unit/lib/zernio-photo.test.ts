import { describe, expect, it } from 'vitest'
import { instagramPhotoTarget, photoContentType } from '@/lib/zernio-photo'

describe('Instagram photo proxy boundary', () => {
  it('only fronts HTTPS Instagram CDN URLs to a fixed Meta host', () => {
    expect(instagramPhotoTarget('https://scontent-lhr11-1.cdninstagram.com/v/photo.jpg?sig=abc'))
      .toEqual({ url: 'https://www.instagram.com/v/photo.jpg?sig=abc', host: 'scontent-lhr11-1.cdninstagram.com' })
    expect(instagramPhotoTarget('http://scontent-lhr11-1.cdninstagram.com/photo.jpg')).toBeNull()
    expect(instagramPhotoTarget('https://cdninstagram.com.evil.example/photo.jpg')).toBeNull()
    expect(instagramPhotoTarget('https://127.0.0.1/photo.jpg')).toBeNull()
  })

  it('accepts image bytes, not HTML or SVG', () => {
    expect(photoContentType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg')
    expect(photoContentType(new TextEncoder().encode('<svg></svg>'))).toBeNull()
  })
})

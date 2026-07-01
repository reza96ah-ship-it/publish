import { describe, it, expect } from 'vitest'
import {
  PROVIDER_CAPABILITIES,
  getCapabilities,
  validateAgainstCapabilities,
  type PlatformKey,
} from '../../../src/lib/provider-capabilities'
// Worker entry point — re-exports the same shared module (see below). No
// hand-maintained copy exists anymore (Issue #150), so this import is
// expected to be reference-identical to the shared module's exports, not
// just deep-equal.
import {
  PROVIDER_CAPABILITIES as WORKER_CAPS,
  getCapabilities as workerGetCaps,
  validateAgainstCapabilities as workerValidate,
} from '../../../mini-services/publish-worker/lib/provider-capabilities'
// The single shared source of truth both entry points re-export from.
import { PROVIDER_CAPABILITIES as SHARED_CAPS } from '../../../shared/provider-capabilities'

describe('Issue #117 / #150 — Provider Capability Registry (single shared module)', () => {
  describe('app + worker entry points re-export the same shared module (no duplication)', () => {
    it('app entry point is reference-identical to the shared module', () => {
      expect(PROVIDER_CAPABILITIES).toBe(SHARED_CAPS)
    })

    it('worker entry point is reference-identical to the shared module', () => {
      expect(WORKER_CAPS).toBe(SHARED_CAPS)
    })

    it('exports the same PROVIDER_CAPABILITIES object', () => {
      expect(WORKER_CAPS).toEqual(PROVIDER_CAPABILITIES)
    })

    it('getCapabilities returns identical results for all platforms', () => {
      const platforms: PlatformKey[] = [
        'telegram',
        'instagram',
        'linkedin',
        'rubika',
        'bale',
        'eitaa',
      ]
      for (const p of platforms) {
        expect(workerGetCaps(p)).toEqual(getCapabilities(p))
      }
    })

    it('validateAgainstCapabilities returns identical results', () => {
      const content = { body: 'x'.repeat(3000), hashtags: '#a #b', mediaCount: 1 }
      for (const p of ['telegram', 'instagram', 'linkedin'] as const) {
        expect(workerValidate(p, content)).toEqual(validateAgainstCapabilities(p, content))
      }
    })
  })

  describe('all 6 platforms are registered with required keys', () => {
    const requiredKeys = [
      'supportsText',
      'supportsImage',
      'supportsVideo',
      'maxTextLength',
      'maxCaptionLength',
      'requiresMedia',
      'maxMediaCount',
      'maxHashtags',
      'label',
    ] as const

    for (const platform of Object.keys(PROVIDER_CAPABILITIES) as PlatformKey[]) {
      it(`${platform} has all required capability keys`, () => {
        const cap = PROVIDER_CAPABILITIES[platform]
        for (const key of requiredKeys) {
          expect(cap).toHaveProperty(key)
        }
      })
    }
  })

  describe('platform-specific capability facts', () => {
    it('Instagram requires media (text-only posts are impossible)', () => {
      expect(PROVIDER_CAPABILITIES.instagram.requiresMedia).toBe(true)
      expect(PROVIDER_CAPABILITIES.instagram.supportsText).toBe(false)
    })

    it('Telegram supports text-only posts', () => {
      expect(PROVIDER_CAPABILITIES.telegram.supportsText).toBe(true)
      expect(PROVIDER_CAPABILITIES.telegram.requiresMedia).toBe(false)
    })

    it('Telegram media caption limit is 1024 (NOT 4096)', () => {
      expect(PROVIDER_CAPABILITIES.telegram.maxCaptionLength).toBe(1024)
      expect(PROVIDER_CAPABILITIES.telegram.maxTextLength).toBe(4096)
    })

    it('Bale shares Telegram limits (Telegram-compatible API)', () => {
      expect(PROVIDER_CAPABILITIES.bale.maxCaptionLength).toBe(1024)
      expect(PROVIDER_CAPABILITIES.bale.maxTextLength).toBe(4096)
    })

    it('Instagram caption limit is 2200 with max 30 hashtags', () => {
      expect(PROVIDER_CAPABILITIES.instagram.maxCaptionLength).toBe(2200)
      expect(PROVIDER_CAPABILITIES.instagram.maxHashtags).toBe(30)
    })

    it('LinkedIn commentary limit is 3000 with no hashtag limit', () => {
      expect(PROVIDER_CAPABILITIES.linkedin.maxTextLength).toBe(3000)
      expect(PROVIDER_CAPABILITIES.linkedin.maxHashtags).toBeNull()
    })

    it('LinkedIn supports up to 9 images (carousel)', () => {
      expect(PROVIDER_CAPABILITIES.linkedin.maxMediaCount).toBe(9)
    })
  })

  describe('getCapabilities fallback for unknown platforms', () => {
    it('returns telegram-like capabilities for unknown platform', () => {
      const cap = getCapabilities('unknown_platform')
      expect(cap.maxTextLength).toBe(4096)
      expect(cap.requiresMedia).toBe(false)
    })
  })

  describe('validateAgainstCapabilities — Issue #117 acceptance criteria', () => {
    it('Instagram selected without media → media_missing violation (blocks submit)', () => {
      const issues = validateAgainstCapabilities('instagram', {
        body: 'hello',
        hashtags: null,
        mediaCount: 0,
      })
      expect(issues.some((i) => i.code === 'media_missing')).toBe(true)
    })

    it('Instagram with media → no media_missing violation', () => {
      const issues = validateAgainstCapabilities('instagram', {
        body: 'hello',
        hashtags: null,
        mediaCount: 1,
      })
      expect(issues.some((i) => i.code === 'media_missing')).toBe(false)
    })

    it('Telegram text over 4096 chars → caption_too_long (text-only limit)', () => {
      const issues = validateAgainstCapabilities('telegram', {
        body: 'x'.repeat(4097),
        hashtags: null,
        mediaCount: 0,
      })
      expect(issues.some((i) => i.code === 'caption_too_long')).toBe(true)
    })

    it('Telegram text 3000 chars WITH media → caption_too_long (1024 caption limit)', () => {
      // 3000 < 4096 (text limit) but > 1024 (caption limit) → must flag
      const issues = validateAgainstCapabilities('telegram', {
        body: 'x'.repeat(3000),
        hashtags: null,
        mediaCount: 1,
      })
      expect(issues.some((i) => i.code === 'caption_too_long')).toBe(true)
    })

    it('Telegram text 1024 chars WITH media → no violation', () => {
      const issues = validateAgainstCapabilities('telegram', {
        body: 'x'.repeat(1024),
        hashtags: null,
        mediaCount: 1,
      })
      expect(issues).toHaveLength(0)
    })

    it('LinkedIn text 2500 chars → no violation (under 3000 limit)', () => {
      const issues = validateAgainstCapabilities('linkedin', {
        body: 'x'.repeat(2500),
        hashtags: null,
        mediaCount: 0,
      })
      expect(issues).toHaveLength(0)
    })

    it('LinkedIn text 3001 chars → caption_too_long', () => {
      const issues = validateAgainstCapabilities('linkedin', {
        body: 'x'.repeat(3001),
        hashtags: null,
        mediaCount: 0,
      })
      expect(issues.some((i) => i.code === 'caption_too_long')).toBe(true)
    })

    it('Instagram with 31 hashtags → too_many_hashtags', () => {
      const tags = Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(' ')
      const issues = validateAgainstCapabilities('instagram', {
        body: 'hello',
        hashtags: tags,
        mediaCount: 1,
      })
      expect(issues.some((i) => i.code === 'too_many_hashtags')).toBe(true)
    })

    it('Instagram with 30 hashtags → no violation', () => {
      const tags = Array.from({ length: 30 }, (_, i) => `#tag${i}`).join(' ')
      const issues = validateAgainstCapabilities('instagram', {
        body: 'hello',
        hashtags: tags,
        mediaCount: 1,
      })
      expect(issues.some((i) => i.code === 'too_many_hashtags')).toBe(false)
    })

    it('LinkedIn with 50 hashtags → no violation (no hashtag limit)', () => {
      const tags = Array.from({ length: 50 }, (_, i) => `#tag${i}`).join(' ')
      const issues = validateAgainstCapabilities('linkedin', {
        body: 'hello',
        hashtags: tags,
        mediaCount: 0,
      })
      expect(issues.some((i) => i.code === 'too_many_hashtags')).toBe(false)
    })

    it('all violations include the platform name for UI display', () => {
      const issues = validateAgainstCapabilities('instagram', {
        body: 'x'.repeat(3000),
        hashtags: '#a #b #c',
        mediaCount: 0,
      })
      for (const iss of issues) {
        expect(iss.platform).toBe('instagram')
        expect(iss.message).toBeTruthy()
        expect(iss.code).toBeTruthy()
      }
    })
  })
})

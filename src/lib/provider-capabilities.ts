/**
 * Provider Capability Registry (Issue #117)
 *
 * Single source of truth for what each social platform supports.
 * Used by:
 *   - Composer UI (src/components/views/compose-view.tsx) — show/hide media
 *     upload, live character counters, submit validation.
 *   - Worker adapters (mini-services/publish-worker/adapters/*) — validate
 *     content before calling the provider API.
 *
 * KEEP IN SYNC with mini-services/publish-worker/lib/provider-capabilities.ts
 * (worker Docker image excludes src/, so a copy is required — same pattern as
 * crypto.ts). A unit test (tests/unit/lib/provider-capabilities.test.ts) asserts
 * both files export identical data.
 *
 * Research sources:
 *   - Telegram Bot API: text 4096, media caption 1024, supports text/image/video/document
 *   - Instagram Graph API: caption 2200, 30 hashtags, REQUIRES media (image/video/reel)
 *   - LinkedIn Posts API: commentary 3000, supports text/image/video, no hashtag limit
 *   - Bale Bot API: Telegram-compatible, text 4096, caption 1024
 *   - Rubika Bot API: text 4096, caption 1024, supports text/image/video
 *   - Eitaa: Rubika-compatible (reuses Rubika adapter)
 */

export type PlatformKey =
  | 'telegram'
  | 'instagram'
  | 'linkedin'
  | 'rubika'
  | 'bale'
  | 'eitaa'

export interface ProviderCapability {
  /** Whether the platform supports text-only posts (no media). */
  supportsText: boolean
  /** Whether the platform supports image attachments. */
  supportsImage: boolean
  /** Whether the platform supports video attachments. */
  supportsVideo: boolean
  /** Max characters for a text-only message (sendMessage). */
  maxTextLength: number
  /** Max characters for a caption attached to media (sendPhoto/sendVideo caption). */
  maxCaptionLength: number
  /** Whether the platform REQUIRES at least one media item (e.g. Instagram). */
  requiresMedia: boolean
  /** Max number of media items per post (carousel/album). 1 = single only. */
  maxMediaCount: number
  /** Max number of hashtags (Instagram = 30). null = no limit. */
  maxHashtags: number | null
  /** Human-readable platform name in Persian (for UI labels). */
  label: string
}

export const PROVIDER_CAPABILITIES: Record<PlatformKey, ProviderCapability> = {
  telegram: {
    supportsText: true,
    supportsImage: true,
    supportsVideo: true,
    maxTextLength: 4096,
    maxCaptionLength: 1024,
    requiresMedia: false,
    maxMediaCount: 10,
    maxHashtags: null,
    label: 'تلگرام',
  },
  instagram: {
    supportsText: false,
    supportsImage: true,
    supportsVideo: true,
    maxTextLength: 2200,
    maxCaptionLength: 2200,
    requiresMedia: true,
    maxMediaCount: 10,
    maxHashtags: 30,
    label: 'اینستاگرام',
  },
  linkedin: {
    supportsText: true,
    supportsImage: true,
    supportsVideo: true,
    maxTextLength: 3000,
    maxCaptionLength: 3000,
    requiresMedia: false,
    maxMediaCount: 9,
    maxHashtags: null,
    label: 'لینکدین',
  },
  rubika: {
    supportsText: true,
    supportsImage: true,
    supportsVideo: true,
    maxTextLength: 4096,
    maxCaptionLength: 1024,
    requiresMedia: false,
    maxMediaCount: 10,
    maxHashtags: null,
    label: 'روبیکا',
  },
  bale: {
    supportsText: true,
    supportsImage: true,
    supportsVideo: true,
    maxTextLength: 4096,
    maxCaptionLength: 1024,
    requiresMedia: false,
    maxMediaCount: 10,
    maxHashtags: null,
    label: 'بله',
  },
  eitaa: {
    supportsText: true,
    supportsImage: true,
    supportsVideo: true,
    maxTextLength: 4096,
    maxCaptionLength: 1024,
    requiresMedia: false,
    maxMediaCount: 10,
    maxHashtags: null,
    label: 'ایتا',
  },
}

/**
 * Get capabilities for a platform type. Returns a safe default (telegram-like)
 * for unknown platforms so the UI never crashes.
 */
export function getCapabilities(platform: string): ProviderCapability {
  return (
    PROVIDER_CAPABILITIES[platform as PlatformKey] ?? PROVIDER_CAPABILITIES.telegram
  )
}

/**
 * Validate content against the capability registry.
 * Returns a list of Persian, actionable issues (empty = ready).
 *
 * Used by both the composer UI (pre-submit) and the worker adapters
 * (pre-publish) so validation rules never diverge.
 */
export interface CapabilityViolation {
  code: string
  message: string
  platform: string
}

export function validateAgainstCapabilities(
  platform: string,
  content: { body: string | null; hashtags: string | null; mediaCount: number }
): CapabilityViolation[] {
  const cap = getCapabilities(platform)
  const issues: CapabilityViolation[] = []
  const text = content.body ?? ''
  const isMediaPost = content.mediaCount > 0
  const effectiveLimit = isMediaPost ? cap.maxCaptionLength : cap.maxTextLength

  // Length check — uses caption limit when media is attached, text limit otherwise
  if (text.length > effectiveLimit) {
    issues.push({
      code: 'caption_too_long',
      message: `متن نباید از ${effectiveLimit} کاراکتر بیشتر باشد (پلتفرم: ${cap.label}).`,
      platform,
    })
  }

  // Media requirement (Instagram)
  if (cap.requiresMedia && content.mediaCount === 0) {
    issues.push({
      code: 'media_missing',
      message: `${cap.label} به حداقل یک تصویر یا ویدیو نیاز دارد.`,
      platform,
    })
  }

  // Hashtag limit (Instagram = 30)
  if (cap.maxHashtags !== null) {
    const hashtagCount = (content.hashtags?.match(/#/g) || []).length
    if (hashtagCount > cap.maxHashtags) {
      issues.push({
        code: 'too_many_hashtags',
        message: `${cap.label} حداکثر ${cap.maxHashtags} هشتگ مجاز می‌کند.`,
        platform,
      })
    }
  }

  // Media count limit
  if (content.mediaCount > cap.maxMediaCount) {
    issues.push({
      code: 'too_many_media',
      message: `${cap.label} حداکثر ${cap.maxMediaCount} رسانه در هر پست مجاز می‌کند.`,
      platform,
    })
  }

  return issues
}

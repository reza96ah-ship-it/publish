/**
 * Provider Capability Registry (Issue #117, Issue #150)
 *
 * SINGLE SOURCE OF TRUTH for what each social platform supports.
 *
 * This module lives at the repo root (outside `src/` and outside
 * `mini-services/`) specifically so BOTH the Next.js app and the worker
 * mini-service can import the exact same file at runtime — no copy, no
 * generation step, no "keep in sync" unit test required.
 *
 * Consumers:
 *   - Next.js app: src/lib/provider-capabilities.ts re-exports this module.
 *     Used by the Composer UI (src/components/views/compose-view.tsx) — show/hide
 *     media upload, live character counters, submit validation — and by any
 *     component surfacing provider support level (Issue #150).
 *   - Worker: mini-services/publish-worker/lib/provider-capabilities.ts
 *     re-exports this module. Used by the worker adapters
 *     (mini-services/publish-worker/adapters/*) to validate content before
 *     calling the provider API.
 *
 * This module has ZERO dependencies on Next.js, React, or Prisma — it is
 * plain TypeScript/data so it is safe to import from the lean worker Docker
 * image (see Dockerfile `worker` stage, which COPYs `shared/` alongside
 * `mini-services/publish-worker/`).
 *
 * Research sources:
 *   - Telegram Bot API: text 4096, media caption 1024, supports text/image/video/document
 *   - Instagram Graph API: caption 2200, 30 hashtags, REQUIRES media (image/video/reel)
 *   - LinkedIn Posts API: commentary 3000, supports text/image/video, no hashtag limit
 *   - Bale Bot API: Telegram-compatible, text 4096, caption 1024
 *   - Rubika Bot API: text 4096, caption 1024, supports text/image/video
 *   - Eitaa: Rubika-compatible (reuses Rubika adapter)
 */

import { DEFAULT_INSTAGRAM_GRAPH_API_VERSION } from './instagram-graph'

export type PlatformKey =
  | 'telegram'
  | 'instagram'
  | 'linkedin'
  | 'rubika'
  | 'bale'
  | 'eitaa'

/**
 * Issue #150: provider support level — the UI must display the real support level.
 * - certified: tested with real provider accounts, contract tests pass
 * - beta: implemented but not yet certified with real accounts
 * - experimental: protocol compatibility assumed but not verified
 */
export type ProviderSupportLevel = 'certified' | 'beta' | 'experimental'

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
  /** Issue #150: support level — certified, beta, or experimental */
  supportLevel: ProviderSupportLevel
  /** Issue #150: provider API version (for observability + sunset tracking) */
  apiVersion: string
  /** Issue #150: documented duplicate guarantee (for reliability report) */
  duplicateGuarantee: 'idempotent' | 'reconcilable' | 'none'
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
    supportLevel: 'certified',
    apiVersion: 'Bot API 8.x',
    duplicateGuarantee: 'none',
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
    supportLevel: 'beta',
    apiVersion: `Graph API ${DEFAULT_INSTAGRAM_GRAPH_API_VERSION}`,
    duplicateGuarantee: 'reconcilable',
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
    supportLevel: 'beta',
    apiVersion: 'REST Posts API 202606',
    duplicateGuarantee: 'reconcilable',
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
    supportLevel: 'experimental',
    apiVersion: 'Bot API v3',
    duplicateGuarantee: 'none',
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
    supportLevel: 'experimental',
    apiVersion: 'Bot API (Bale)',
    duplicateGuarantee: 'none',
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
    supportLevel: 'experimental',
    apiVersion: 'Bot API v3 (Eitaa)',
    duplicateGuarantee: 'none',
  },
}

/**
 * Platforms currently enabled in the product. All other platforms are fully
 * implemented (adapters, capabilities, workers) but hidden from every user
 * surface — connect dialogs, OAuth start, bot-token connect, analytics
 * filters, and seed data. To re-enable a platform, add its key here.
 */
export const ENABLED_PLATFORMS: readonly PlatformKey[] = ['instagram']

export function isPlatformEnabled(platform: string): boolean {
  return (ENABLED_PLATFORMS as readonly string[]).includes(platform)
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

/**
 * Instagram Graph API adapter — two-step publish (container → media_publish).
 * Mock mode simulates the real flow with realistic delays and failure modes.
 *
 * Real API reference:
 *   Step 1: POST /{ig-user-id}/media (create container)
 *   Step 2: POST /{ig-user-id}/media_publish (publish the container)
 *   Rate limit: 100 posts / 24h (50 for carousels)
 *   Container expiry: ~30s after creation
 */

import type {
  ChannelAdapter,
  PlatformType,
  AdapterJob,
  PublishResult,
  HealthResult,
  ReadinessResult,
  AdapterContent,
  AdapterAccount,
} from './types'

const IG_CAPTION_LIMIT = 2200
const SIMULATED_FAILURE_RATE = 0.05 // 5% transient failure (matches real-world IG flakiness)

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function mockFail(): boolean {
  return Math.random() < SIMULATED_FAILURE_RATE
}

export class InstagramAdapter implements ChannelAdapter {
  readonly platform: PlatformType = 'instagram'

  async healthCheck(account: AdapterAccount): Promise<HealthResult> {
    await sleep(200)
    if (account.status === 'expired') {
      return { healthy: false, status: 'expired', lastError: 'انقضای توکن حساب اصلی' }
    }
    if (account.status === 'error') {
      return { healthy: false, status: 'error', lastError: 'اختلال API اینستاگرام' }
    }
    return { healthy: true, status: 'active', lastError: null }
  }

  async validateReadiness(content: AdapterContent, _account: AdapterAccount): Promise<ReadinessResult> {
    const issues = []
    const caption = content.body ?? ''
    if (caption.length > IG_CAPTION_LIMIT) {
      issues.push({
        code: 'caption_too_long',
        message: `کپشن اینستاگرام نباید از ${IG_CAPTION_LIMIT} کاراکتر بیشتر باشد.`,
        platform: 'instagram',
      })
    }
    if (!content.thumbnailUrl) {
      issues.push({
        code: 'media_missing',
        message: 'انتشار در اینستاگرام نیازمند حداقل یک رسانه است.',
        platform: 'instagram',
      })
    }
    return { ready: issues.length === 0, issues }
  }

  async publish(job: AdapterJob): Promise<PublishResult> {
    const now = Date.now()
    const caption = job.platformCaption || [job.content.body, job.content.hashtags].filter(Boolean).join('\n\n')

    // ── Step 1: Create media container ──
    await sleep(800) // simulate POST /media
    if (mockFail()) {
      return {
        externalId: null,
        rawResponse: { step: 'create_container', ok: false },
        status: 'failed',
        error: 'خطای موقت در ایجاد کانتینر رسانه (۵۰۳). تلاش مجدد انجام خواهد شد.',
        retryable: true,
        steps: [
          { label: 'ایجاد کانتینر رسانه', at: now },
          { label: 'خطا در ایجاد کانتینر', at: Date.now() },
        ],
      }
    }
    const containerId = `ig_container_${job.idempotencyKey.slice(0, 12)}`

    // ── Step 2: Publish the container ──
    await sleep(1200) // simulate POST /media_publish
    if (mockFail()) {
      return {
        externalId: null,
        rawResponse: { step: 'media_publish', containerId, ok: false },
        status: 'failed',
        error: 'خطای موقت در انتشار کانتینر (۴۲۹ — محدودیت نرخ). تلاش مجدد انجام خواهد شد.',
        retryable: true,
        steps: [
          { label: 'ایجاد کانتینر رسانه', at: now },
          { label: 'انتشار کانتینر', at: now + 800 },
          { label: 'خطا در انتشار', at: Date.now() },
        ],
      }
    }

    const mediaId = `ig_media_${Date.now()}`
    return {
      externalId: mediaId,
      rawResponse: {
        step: 'media_publish',
        containerId,
        mediaId,
        isAiGenerated: false,
      },
      status: 'success',
      error: null,
      retryable: false,
      steps: [
        { label: 'ایجاد کانتینر رسانه', at: now },
        { label: 'انتشار کانتینر', at: now + 800 },
        { label: 'منتشر شد', at: Date.now() },
      ],
    }
  }
}

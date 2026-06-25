/**
 * LinkedIn API adapter — ugcPosts (text/image share).
 * Mock mode simulates the two-step image upload + share flow.
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

const LI_TEXT_LIMIT = 3000
const SIMULATED_FAILURE_RATE = 0.03

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function mockFail(): boolean {
  return Math.random() < SIMULATED_FAILURE_RATE
}

export class LinkedInAdapter implements ChannelAdapter {
  readonly platform: PlatformType = 'linkedin'

  async healthCheck(account: AdapterAccount): Promise<HealthResult> {
    await sleep(200)
    if (account.status === 'expired') {
      return { healthy: false, status: 'expired', lastError: 'توکن لینکدین منقضی شده است' }
    }
    return { healthy: true, status: 'active', lastError: null }
  }

  async validateReadiness(content: AdapterContent, _account: AdapterAccount): Promise<ReadinessResult> {
    const issues = []
    const text = content.body ?? ''
    if (text.length > LI_TEXT_LIMIT) {
      issues.push({
        code: 'caption_too_long',
        message: `متن پست لینکدین نباید از ${LI_TEXT_LIMIT} کاراکتر بیشتر باشد.`,
        platform: 'linkedin',
      })
    }
    return { ready: issues.length === 0, issues }
  }

  async publish(job: AdapterJob): Promise<PublishResult> {
    const now = Date.now()
    const text = job.platformCaption || [job.content.title, job.content.body, job.content.hashtags].filter(Boolean).join('\n\n')

    // Step 1: register image (if media present) — simulated
    if (job.content.thumbnailUrl) {
      await sleep(500)
    }

    // Step 2: create UGC post
    await sleep(700)
    if (mockFail()) {
      return {
        externalId: null,
        rawResponse: { step: 'ugcPosts', ok: false },
        status: 'failed',
        error: 'خطای موقت در انتشار لینکدین (۵۰۳).',
        retryable: true,
        steps: [
          { label: 'ثبت رسانه', at: now },
          { label: 'ایجاد پست لینکدین', at: now + 500 },
          { label: 'خطا', at: Date.now() },
        ],
      }
    }

    const urn = `urn:li:share:${Date.now()}`
    return {
      externalId: urn,
      rawResponse: { step: 'ugcPosts', urn, textLength: text.length },
      status: 'success',
      error: null,
      retryable: false,
      steps: [
        { label: 'ثبت رسانه', at: now },
        { label: 'ایجاد پست لینکدین', at: now + 500 },
        { label: 'منتشر شد', at: Date.now() },
      ],
    }
  }
}

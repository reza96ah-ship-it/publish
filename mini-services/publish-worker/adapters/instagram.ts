/**
 * Instagram Graph API adapter — REAL implementation.
 * 
 * Official docs: https://developers.facebook.com/docs/instagram-api
 * Content Publishing guide: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 * 
 * Auth: OAuth 2.0 via Facebook Login. Requires Instagram Business/Creator account + Facebook Page.
 * URL: https://graph.facebook.com/v21.0/{endpoint}
 * 
 * Two-step publish process:
 *   1. POST /{ig-user-id}/media → create media container → returns { id }
 *   2. POST /{ig-user-id}/media_publish?creation_id={container_id} → publish
 * 
 * Media types: IMAGE, VIDEO, REEL, CAROUSEL (2-10 items)
 * Caption limit: 2200 chars, 30 hashtags
 * Rate limit: 200 calls/hour per user
 * Token: long-lived (60 days, must refresh before expiry)
 * 
 * Permissions needed: instagram_basic, instagram_content_publish, pages_show_list,
 *   pages_read_engagement, instagram_manage_insights
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
const IG_HASHTAG_LIMIT = 30
const GRAPH_API = 'https://graph.facebook.com/v21.0'

export class InstagramAdapter implements ChannelAdapter {
  readonly platform: PlatformType = 'instagram'

  async healthCheck(account: AdapterAccount): Promise<HealthResult> {
    const token = account.token
    const igUserId = account.targetId
    if (!token || !igUserId) {
      return { healthy: false, status: 'disconnected', lastError: 'توکن یا شناسه کاربر اینستاگرام تنظیم نشده است' }
    }
    try {
      const res = await fetch(
        `${GRAPH_API}/${igUserId}?fields=username,followers_count&access_token=${token}`
      )
      const data = await res.json()
      if (data.error) {
        return { healthy: false, status: 'expired', lastError: data.error.message || 'توکن منقضی شده است' }
      }
      return { healthy: true, status: 'active', lastError: null }
    } catch (err) {
      return { healthy: false, status: 'error', lastError: 'خطای شبکه در بررسی وضعیت اینستاگرام' }
    }
  }

  async validateReadiness(content: AdapterContent, account: AdapterAccount): Promise<ReadinessResult> {
    const issues = []
    const caption = this.buildCaption(content)
    
    if (caption.length > IG_CAPTION_LIMIT) {
      issues.push({
        code: 'caption_too_long',
        message: `کپشن اینستاگرام نباید از ${IG_CAPTION_LIMIT} کاراکتر بیشتر باشد.`,
        platform: 'instagram',
      })
    }

    // Count hashtags
    const hashtagCount = (content.hashtags?.match(/#/g) || []).length
    if (hashtagCount > IG_HASHTAG_LIMIT) {
      issues.push({
        code: 'too_many_hashtags',
        message: `اینستاگرام حداکثر ${IG_HASHTAG_LIMIT} هشتگ مجاز است.`,
        platform: 'instagram',
      })
    }

    // Instagram REQUIRES media
    if (!content.mediaItems || content.mediaItems.length === 0) {
      issues.push({
        code: 'media_missing',
        message: 'اینستاگرام به حداقل یک تصویر یا ویدیو نیاز دارد.',
        platform: 'instagram',
      })
    }

    if (!account.token || !account.targetId) {
      issues.push({
        code: 'token_expired',
        message: 'توکن اینستاگرام تنظیم نشده است. لطفاً حساب را مجدداً متصل کنید.',
        platform: 'instagram',
      })
    }

    return { ready: issues.length === 0, issues }
  }

  async publish(job: AdapterJob): Promise<PublishResult> {
    const now = Date.now()
    const { account, content, platformCaption } = job
    const token = account.token
    const igUserId = account.targetId

    if (!token || !igUserId) {
      return {
        externalId: null,
        rawResponse: {},
        status: 'action',
        error: 'توکن یا شناسه کاربر اینستاگرام تنظیم نشده است. لطفاً حساب را مجدداً متصل کنید.',
        retryable: false,
        steps: [{ label: 'بررسی توکن', at: now }],
      }
    }

    const caption = platformCaption || this.buildCaption(content)
    const mediaItems = content.mediaItems || []

    if (mediaItems.length === 0) {
      return {
        externalId: null,
        rawResponse: {},
        status: 'action',
        error: 'اینستاگرام به حداقل یک تصویر یا ویدیو نیاز دارد.',
        retryable: false,
        steps: [{ label: 'بررسی رسانه', at: now }],
      }
    }

    try {
      let containerId: string

      // Step 1: Create media container(s)
      if (mediaItems.length === 1) {
        // Single media
        const m = mediaItems[0]
        containerId = await this.createMediaContainer(token, igUserId, m, caption)
        
        // For video/reel, wait for processing
        if (m.type === 'video' || m.type === 'reel') {
          await this.waitForProcessing(token, containerId)
        }
      } else {
        // Carousel (2-10 items)
        const childIds: string[] = []
        for (const m of mediaItems.slice(0, 10)) {
          const childId = await this.createMediaContainer(token, igUserId, m, undefined, true)
          childIds.push(childId)
        }
        containerId = await this.createCarouselContainer(token, igUserId, childIds, caption)
      }

      // Step 2: Publish
      const publishRes = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: token,
        }),
      })
      const published = await publishRes.json()

      if (published.error) throw this.makeError(published.error)

      return {
        externalId: published.id,
        rawResponse: published,
        status: 'success',
        error: null,
        retryable: false,
        steps: [
          { label: 'ایجاد کانتینر رسانه', at: now },
          { label: 'انتشار در اینستاگرام', at: Date.now() },
        ],
      }
    } catch (err: any) {
      const retryable = err.code === 4 || err.code === 32 || (err.code && err.code >= 500)
      return {
        externalId: null,
        rawResponse: { error: err.message, code: err.code },
        status: retryable ? 'failed' : 'action',
        error: err.message,
        retryable,
        steps: [
          { label: 'انتشار در اینستاگرام', at: now },
          { label: 'خطا', at: Date.now() },
        ],
      }
    }
  }

  private buildCaption(content: AdapterContent): string {
    const parts = [content.body, content.hashtags].filter(Boolean)
    return parts.join('\n\n')
  }

  private async createMediaContainer(
    token: string,
    igUserId: string,
    media: { type: string; url: string },
    caption?: string,
    isCarouselItem = false,
  ): Promise<string> {
    const body: any = {
      access_token: token,
    }

    if (media.type === 'photo') {
      body.image_url = media.url
    } else if (media.type === 'video') {
      body.media_type = 'VIDEO'
      body.video_url = media.url
    } else if (media.type === 'reel') {
      body.media_type = 'REELS'
      body.video_url = media.url
    } else {
      // Default to image
      body.image_url = media.url
    }

    if (isCarouselItem) {
      body.is_carousel_item = true
    } else if (caption) {
      body.caption = caption
    }

    const res = await fetch(`${GRAPH_API}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.error) throw this.makeError(data.error)
    return data.id
  }

  private async createCarouselContainer(
    token: string,
    igUserId: string,
    childIds: string[],
    caption: string,
  ): Promise<string> {
    const res = await fetch(`${GRAPH_API}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption,
        access_token: token,
      }),
    })
    const data = await res.json()
    if (data.error) throw this.makeError(data.error)
    return data.id
  }

  private async waitForProcessing(token: string, containerId: string): Promise<void> {
    for (let i = 0; i < 30; i++) {
      const res = await fetch(
        `${GRAPH_API}/${containerId}?fields=status_code&access_token=${token}`
      )
      const data = await res.json()
      if (data.status_code === 'FINISHED') return
      if (data.status_code === 'ERROR') throw new Error('پردازش ویدیوی اینستاگرام ناموفق بود')
      await new Promise((r) => setTimeout(r, 5000))  // wait 5s
    }
    throw new Error('زمان پردازش ویدیوی اینستاگرام به پایان رسید')
  }

  private makeError(metaError: any): Error {
    const err = new Error(`اینستاگرام: ${metaError.message}`) as any
    err.code = metaError.code
    return err
  }
}

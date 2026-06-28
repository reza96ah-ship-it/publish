/**
 * LinkedIn Posts API adapter — REAL implementation (Issue #114 fix).
 *
 * Official docs: https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api
 * Auth docs: https://learn.microsoft.com/linkedin/shared/authentication/authorization-code-flow
 *
 * Auth: OAuth 2.0 (3-legged). Access token (60 days, must refresh).
 * Permissions: w_member_social (post as member), r_organization_social + w_organization_social (post as org)
 *
 * Issue #114 fixes (all verified against official docs 2025-06):
 *   1. Endpoint moved from deprecated /v2/posts → /rest/posts
 *      (docs: "POST https://api.linkedin.com/rest/posts")
 *   2. Added required LinkedIn-Version header (YYYYMM format).
 *      202506 was sunset; 202505 is current valid.
 *   3. X-Restli-Protocol-Version: 2.0.0 header (already present, kept).
 *   4. 201 Created response has an EMPTY body — the post URN is in the
 *      `x-restli-id` response header, NOT in JSON. Previous code called
 *      res.json() on the empty body which threw silently.
 *   5. Body schema fixed: visibility must be "PUBLIC" (not an object),
 *      and distribution.feedDistribution = "MAIN_FEED" is required for
 *      the post to appear on the feed.
 *   6. Added normalizeLinkedInError covering 401/403 (auth), 429 (rate limit),
 *      5xx (retryable). Returns typed errorCategory so the worker never
 *      retries auth failures (BUG-05).
 *
 * Two-step image upload:
 *   1. POST /rest/assets?action=registerUpload → get uploadUrl + asset URN
 *   2. PUT <uploadUrl> with binary image data
 *   3. POST /rest/posts with content.media.id = asset URN
 *
 * Rate limits: 100K calls/day app-level, ~90 posts/day per member.
 * Token refresh: POST /oauth/v2/accessToken with refresh_token (60-day cycle).
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
  ErrorCategory,
} from './types'
import { getCapabilities } from '../lib/provider-capabilities'

// Issue #114: named constants — LinkedIn-Version in YYYYMM format.
// Update this when LinkedIn sunsets the current version (check Microsoft Learn).
// 202506 (June 2025) was sunset; 202505 remains valid as of 2025-06.
const LI_VERSION = '202505'
const LI_REST_API = 'https://api.linkedin.com/rest'
const LI_V2_API = 'https://api.linkedin.com/v2' // userinfo + assets still on v2

export class LinkedInAdapter implements ChannelAdapter {
  readonly platform: PlatformType = 'linkedin'

  async healthCheck(account: AdapterAccount): Promise<HealthResult> {
    const token = account.token
    if (!token) {
      return { healthy: false, status: 'disconnected', lastError: 'توکن لینکدین تنظیم نشده است' }
    }
    try {
      const res = await fetch(`${LI_V2_API}/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        return { healthy: false, status: 'expired', lastError: 'توکن لینکدین منقضی شده است' }
      }
      if (!res.ok) {
        return { healthy: false, status: 'error', lastError: 'خطا در بررسی وضعیت لینکدین' }
      }
      return { healthy: true, status: 'active', lastError: null }
    } catch (err) {
      return { healthy: false, status: 'error', lastError: 'خطای شبکه در بررسی وضعیت لینکدین' }
    }
  }

  async validateReadiness(
    content: AdapterContent,
    account: AdapterAccount
  ): Promise<ReadinessResult> {
    const issues = []
    const text = content.body ?? ''
    // Issue #117: use capability registry as single source of truth
    const cap = getCapabilities('linkedin')
    if (text.length > cap.maxTextLength) {
      issues.push({
        code: 'caption_too_long',
        message: `متن پست لینکدین نباید از ${cap.maxTextLength} کاراکتر بیشتر باشد.`,
        platform: 'linkedin',
      })
    }
    if (!account.token) {
      issues.push({
        code: 'token_expired',
        message: 'توکن لینکدین تنظیم نشده است. لطفاً حساب را مجدداً متصل کنید.',
        platform: 'linkedin',
      })
    }
    if (!account.targetId) {
      issues.push({
        code: 'author_missing',
        message: 'شناسه نویسنده (URN) لینکدین تنظیم نشده است.',
        platform: 'linkedin',
      })
    }
    return { ready: issues.length === 0, issues }
  }

  async publish(job: AdapterJob): Promise<PublishResult> {
    const now = Date.now()
    const { account, content, platformCaption } = job
    const token = account.token
    const authorUrn = account.targetId // urn:li:person:{id} or urn:li:organization:{id}

    if (!token) {
      return {
        externalId: null,
        rawResponse: {},
        status: 'action',
        error: 'توکن لینکدین تنظیم نشده است. لطفاً حساب را مجدداً متصل کنید.',
        retryable: false,
        errorCategory: 'auth',
        steps: [{ label: 'بررسی توکن', at: now }],
      }
    }

    if (!authorUrn) {
      return {
        externalId: null,
        rawResponse: {},
        status: 'action',
        error: 'شناسه نویسنده لینکدین تنظیم نشده است.',
        retryable: false,
        steps: [{ label: 'بررسی نویسنده', at: now }],
      }
    }

    const text = platformCaption || this.buildCaption(content)
    const mediaItems = content.mediaItems || []

    try {
      let postBody: any

      if (mediaItems.length === 0) {
        // Text-only post — Issue #114: visibility must be "PUBLIC" + distribution
        postBody = {
          author: authorUrn,
          commentary: text,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }
      } else if (mediaItems.length === 1) {
        // Single image
        const assetUrn = await this.uploadImage(token, authorUrn, mediaItems[0])
        postBody = {
          author: authorUrn,
          commentary: text,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
          content: {
            media: {
              id: assetUrn,
              title: content.title || 'Image',
            },
          },
        }
      } else {
        // Multi-image carousel (up to 9)
        const assetUrns = await Promise.all(
          mediaItems.slice(0, 9).map((m) => this.uploadImage(token, authorUrn, m))
        )
        postBody = {
          author: authorUrn,
          commentary: text,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
          content: {
            multiImage: { images: assetUrns.map((urn) => ({ id: urn })) },
          },
        }
      }

      // Issue #114: use /rest/posts (not deprecated /v2/posts)
      const res = await fetch(`${LI_REST_API}/posts`, {
        method: 'POST',
        headers: this.headers(token),
        body: JSON.stringify(postBody),
      })

      // Issue #114: 201 Created has an EMPTY body — the post URN is in the
      // `x-restli-id` response header. Previous code called res.json() on
      // the empty body which threw "Unexpected end of JSON input" silently.
      if (res.status === 201) {
        const postId = res.headers.get('x-restli-id') || ''
        return {
          externalId: postId,
          rawResponse: { status: 201, postId, header: 'x-restli-id' },
          status: 'success',
          error: null,
          retryable: false,
          steps: [
            { label: 'ایجاد پست لینکدین', at: now },
            { label: 'منتشر شد', at: Date.now() },
          ],
        }
      }

      // Non-201 response — parse error body
      let errorBody: any = {}
      try {
        errorBody = await res.json()
      } catch {
        // body may be empty or non-JSON
        errorBody = { message: res.statusText }
      }

      const normalized = this.normalizeLinkedInError(res.status, errorBody)
      throw normalized
    } catch (err: any) {
      // Issue #114: typed errorCategory so the worker knows whether to retry.
      // Auth errors (401/403) are never retried; 429/5xx are retried.
      const errorCategory: ErrorCategory = err.errorCategory || 'unknown'
      const retryable = errorCategory === 'rate_limit' || errorCategory === 'network'

      return {
        externalId: null,
        rawResponse: { error: err.message, code: err.code, errorCategory },
        status: retryable ? 'failed' : 'action',
        error: err.message,
        retryable,
        errorCategory,
        steps: [
          { label: 'انتشار در لینکدین', at: now },
          { label: 'خطا', at: Date.now() },
        ],
      }
    }
  }

  private buildCaption(content: AdapterContent): string {
    const parts = [content.title, content.body, content.hashtags].filter(Boolean)
    return parts.join('\n\n')
  }

  private async uploadImage(
    token: string,
    authorUrn: string,
    media: { url: string; type?: string }
  ): Promise<string> {
    // Step 1: Register upload (still on v2/assets)
    const registerRes = await fetch(`${LI_V2_API}/assets?action=registerUpload`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: authorUrn,
          serviceRelationships: [
            { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
          ],
        },
      }),
    })
    const register = await registerRes.json()
    if (register.status && register.code) {
      throw this.normalizeLinkedInError(registerRes.status, register)
    }

    const uploadUrl =
      register.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']
        .uploadUrl
    const asset = register.value.asset // urn:li:digitalmediaAsset:{id}

    // Step 2: Download image from URL and upload to LinkedIn
    const imgRes = await fetch(media.url)
    const imageBlob = await imgRes.blob()

    // Step 3: Upload binary
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: imageBlob,
    })

    return asset
  }

  /**
   * Issue #114: headers now include the required LinkedIn-Version.
   * All LinkedIn REST APIs require both:
   *   - LinkedIn-Version: {YYYYMM}
   *   - X-Restli-Protocol-Version: 2.0.0
   */
  private headers(token: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': LI_VERSION,
    }
  }

  /**
   * Issue #114: normalize LinkedIn error responses into typed categories.
   * Covers 401/403 (auth), 429 (rate_limit), 5xx (retryable), 4xx (permanent).
   *
   * The worker uses `errorCategory` (BUG-05) to decide retry behavior:
   *   - 'auth' → UnrecoverableError (never retried, user must reconnect)
   *   - 'rate_limit' → retried with backoff
   *   - 'network' → retried
   *   - 'not_found' / 'unknown' → permanent failure
   */
  private normalizeLinkedInError(status: number, body: any): Error & {
    code: number
    errorCategory: ErrorCategory
  } {
    let errorCategory: ErrorCategory = 'unknown'
    let message = 'خطای ناشناخته لینکدین'

    if (status === 401 || status === 403) {
      errorCategory = 'auth'
      message = 'توکن لینکدین نامعتبر یا منقضی است. لطفاً حساب را مجدداً متصل کنید.'
    } else if (status === 429) {
      errorCategory = 'rate_limit'
      message = 'محدودیت نرخ درخواست لینکدین. لطفاً بعداً تلاش کنید.'
    } else if (status >= 500) {
      errorCategory = 'network'
      message = `خطای سرور لینکدین (${status}). لطفاً بعداً تلاش کنید.`
    } else if (status === 404) {
      errorCategory = 'not_found'
      message = 'منبع لینکدین یافت نشد.'
    } else if (status >= 400) {
      errorCategory = 'unknown'
      message = body?.message || `خطای لینکدین (${status})`
    }

    const err = new Error(`لینکدین: ${message}`) as Error & {
      code: number
      errorCategory: ErrorCategory
    }
    err.code = status
    err.errorCategory = errorCategory
    return err
  }
}

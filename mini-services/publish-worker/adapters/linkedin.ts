/**
 * LinkedIn Posts API adapter — REAL implementation.
 * 
 * Official docs: https://learn.microsoft.com/linkedin/marketing/integrations/community-management/posts/api/create-post
 * Auth docs: https://learn.microsoft.com/linkedin/shared/authentication/authorization-code-flow
 * 
 * Auth: OAuth 2.0 (3-legged). Access token (60 days, must refresh).
 * Permissions: w_member_social (post as member), r_organization_social + w_organization_social (post as org)
 * URL: https://api.linkedin.com/v2/{endpoint}
 * 
 * Two-step image upload:
 *   1. POST /v2/assets?action=registerUpload → get uploadUrl + asset URN
 *   2. PUT <uploadUrl> with binary image data
 *   3. POST /v2/posts with content.media.id = asset URN
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
} from './types'

const LI_TEXT_LIMIT = 3000
const LI_API = 'https://api.linkedin.com/v2'

export class LinkedInAdapter implements ChannelAdapter {
  readonly platform: PlatformType = 'linkedin'

  async healthCheck(account: AdapterAccount): Promise<HealthResult> {
    const token = account.token
    if (!token) {
      return { healthy: false, status: 'disconnected', lastError: 'توکن لینکدین تنظیم نشده است' }
    }
    try {
      const res = await fetch(`${LI_API}/userinfo`, {
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

  async validateReadiness(content: AdapterContent, account: AdapterAccount): Promise<ReadinessResult> {
    const issues = []
    const text = content.body ?? ''
    if (text.length > LI_TEXT_LIMIT) {
      issues.push({
        code: 'caption_too_long',
        message: `متن پست لینکدین نباید از ${LI_TEXT_LIMIT} کاراکتر بیشتر باشد.`,
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
    const authorUrn = account.targetId  // urn:li:person:{id} or urn:li:organization:{id}

    if (!token) {
      return {
        externalId: null,
        rawResponse: {},
        status: 'action',
        error: 'توکن لینکدین تنظیم نشده است. لطفاً حساب را مجدداً متصل کنید.',
        retryable: false,
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
        // Text-only post
        postBody = {
          author: authorUrn,
          lifecycleState: 'PUBLISHED',
          visibility: { publicVisibility: false, memberVisibility: 'ALL' },
          commentary: text,
        }
      } else if (mediaItems.length === 1) {
        // Single image
        const assetUrn = await this.uploadImage(token, authorUrn, mediaItems[0])
        postBody = {
          author: authorUrn,
          lifecycleState: 'PUBLISHED',
          visibility: { publicVisibility: false, memberVisibility: 'ALL' },
          commentary: text,
          content: {
            media: { id: assetUrn, title: content.title || 'Image' },
          },
        }
      } else {
        // Multi-image carousel (up to 9)
        const assetUrns = await Promise.all(
          mediaItems.slice(0, 9).map((m) => this.uploadImage(token, authorUrn, m))
        )
        postBody = {
          author: authorUrn,
          lifecycleState: 'PUBLISHED',
          visibility: { publicVisibility: false, memberVisibility: 'ALL' },
          commentary: text,
          content: {
            multiImage: { images: assetUrns.map((urn) => ({ id: urn })) },
          },
        }
      }

      // Create post
      const res = await fetch(`${LI_API}/posts`, {
        method: 'POST',
        headers: this.headers(token),
        body: JSON.stringify(postBody),
      })
      const data = await res.json()

      if (data.status && data.code) throw this.makeError(data)

      // Post ID is in the response or Location header
      const postId = data.id || res.headers.get('x-linkedin-id') || ''
      return {
        externalId: postId,
        rawResponse: data,
        status: 'success',
        error: null,
        retryable: false,
        steps: [
          { label: 'ایجاد پست لینکدین', at: now },
          { label: 'منتشر شد', at: Date.now() },
        ],
      }
    } catch (err: any) {
      const retryable = err.code === 429 || (err.code && err.code >= 500)
      return {
        externalId: null,
        rawResponse: { error: err.message, code: err.code },
        status: retryable ? 'failed' : 'action',
        error: err.message,
        retryable,
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
    media: { url: string; type?: string },
  ): Promise<string> {
    // Step 1: Register upload
    const registerRes = await fetch(`${LI_API}/assets?action=registerUpload`, {
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
    if (register.status && register.code) throw this.makeError(register)

    const uploadUrl = register.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl
    const asset = register.value.asset  // urn:li:digitalmediaAsset:{id}

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

  private headers(token: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0',
    }
  }

  private makeError(liError: any): Error {
    const err = new Error(`لینکدین: ${liError.message}`) as any
    err.code = liError.status
    return err
  }
}

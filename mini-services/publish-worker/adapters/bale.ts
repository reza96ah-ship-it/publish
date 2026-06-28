/**
 * Bale Bot API adapter — REAL implementation.
 *
 * Official docs: https://docs.bale.ai/
 * URL pattern: https://tapi.bale.ai/bot<TOKEN>/<METHOD_NAME>
 * File download: https://tapi.bale.ai/file/bot<TOKEN>/<file_path>
 *
 * Bale is Telegram-Bot-API-COMPATIBLE — same method names, same response format.
 * The only differences:
 *   1. Base URL: tapi.bale.ai (not api.telegram.org)
 *   2. No parse_mode MarkdownV2 — Bale uses MessageEntity objects for formatting
 *   3. chat_id can be @channelusername for channels (same as Telegram)
 *
 * Auth: Bot token from @botfather in Bale app.
 * To post to a channel: promoteChatMember with can_post_messages=true, then use @channelusername.
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
import { getCapabilities } from '../lib/provider-capabilities'

// Issue #115: Bale is Telegram-Bot-API-compatible, so it shares the same limits.
// Text-only: 4096, media caption: 1024. Bale does NOT support parse_mode
// (uses plain text), so no HTML escaping needed — but caption limit still applies.
const BALE_LIMITS = {
  text: 4096,
  caption: 1024,
} as const
const BALE_API_BASE = 'https://tapi.bale.ai/bot'

export class BaleAdapter implements ChannelAdapter {
  readonly platform: PlatformType = 'bale'

  async healthCheck(account: AdapterAccount): Promise<HealthResult> {
    const token = account.token
    if (!token) {
      return { healthy: false, status: 'disconnected', lastError: 'توکن ربات بله تنظیم نشده است' }
    }
    try {
      const res = await fetch(`${BALE_API_BASE}${token}/getMe`)
      const data = await res.json()
      if (!data.ok) {
        return {
          healthy: false,
          status: 'error',
          lastError: data.description || 'توکن نامعتبر است',
        }
      }
      return { healthy: true, status: 'active', lastError: null }
    } catch (err) {
      return { healthy: false, status: 'error', lastError: 'خطای شبکه در بررسی وضعیت ربات بله' }
    }
  }

  async validateReadiness(
    content: AdapterContent,
    account: AdapterAccount
  ): Promise<ReadinessResult> {
    const issues = []
    const text = content.body ?? ''
    // Issue #115: use capability registry — media posts use caption limit (1024)
    const cap = getCapabilities('bale')
    const isMediaPost = (content.mediaItems?.length ?? 0) > 0
    const limit = isMediaPost ? cap.maxCaptionLength : cap.maxTextLength
    if (text.length > limit) {
      issues.push({
        code: 'caption_too_long',
        message: `متن پیام بله نباید از ${limit} کاراکتر بیشتر باشد.`,
        platform: 'bale',
      })
    }
    if (!account.token) {
      issues.push({
        code: 'token_missing',
        message: 'توکن ربات بله تنظیم نشده است.',
        platform: 'bale',
      })
    }
    if (!account.targetId && !account.username) {
      issues.push({
        code: 'target_missing',
        message: 'شناسه چت یا نام کاربری کانال تنظیم نشده است.',
        platform: 'bale',
      })
    }
    return { ready: issues.length === 0, issues }
  }

  async publish(job: AdapterJob): Promise<PublishResult> {
    const now = Date.now()
    const { account, content, platformCaption } = job
    const token = account.token
    const chatId = account.targetId || account.username

    if (!token) {
      return {
        externalId: null,
        rawResponse: {},
        status: 'action',
        error: 'توکن ربات بله تنظیم نشده است. لطفاً در تنظیمات پلتفرم، توکن را وارد کنید.',
        retryable: false,
        steps: [{ label: 'بررسی توکن', at: now }],
      }
    }

    if (!chatId) {
      return {
        externalId: null,
        rawResponse: {},
        status: 'action',
        error: 'شناسه چت یا نام کاربری کانال بله تنظیم نشده است.',
        retryable: false,
        steps: [{ label: 'بررسی مقصد', at: now }],
      }
    }

    const caption = platformCaption || this.buildCaption(content)
    const mediaItems = content.mediaItems || []

    // Issue #115: enforce caption limit before calling Bale API (1024 for media)
    const isMediaPost = mediaItems.length > 0
    const captionLimit = isMediaPost ? BALE_LIMITS.caption : BALE_LIMITS.text
    if (caption.length > captionLimit) {
      return {
        externalId: null,
        rawResponse: {},
        status: 'action',
        error: `متن بله بیش از حد مجاز است (${caption.length}/${captionLimit}).`,
        retryable: false,
        steps: [{ label: 'بررسی طول متن', at: now }],
      }
    }

    try {
      let result: { messageId: string; raw: any }

      if (mediaItems.length === 0) {
        // Text-only message (Bale does NOT support parse_mode — uses plain text)
        result = await this.sendMessage(token, chatId, caption)
      } else if (mediaItems.length === 1) {
        const m = mediaItems[0]
        if (!m) throw new Error('media item missing')
        if (m.type === 'photo') {
          result = await this.sendPhoto(token, chatId, m.url, caption)
        } else if (m.type === 'video') {
          result = await this.sendVideo(token, chatId, m.url, caption)
        } else {
          result = await this.sendDocument(token, chatId, m.url, caption)
        }
      } else {
        // Media group (album)
        result = await this.sendMediaGroup(token, chatId, mediaItems, caption)
      }

      return {
        externalId: result.messageId,
        rawResponse: result.raw,
        status: 'success',
        error: null,
        retryable: false,
        steps: [
          { label: 'ارسال به بله', at: now },
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
          { label: 'ارسال به بله', at: now },
          { label: 'خطا', at: Date.now() },
        ],
      }
    }
  }

  private buildCaption(content: AdapterContent): string {
    const parts = [content.title, content.body, content.hashtags].filter(Boolean)
    return parts.join('\n\n')
  }

  private async sendMessage(token: string, chatId: string, text: string) {
    const res = await fetch(`${BALE_API_BASE}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    const data = await res.json()
    if (!data.ok) throw this.makeError(data)
    return { messageId: String(data.result.message_id), raw: data.result }
  }

  private async sendPhoto(token: string, chatId: string, photoUrl: string, caption: string) {
    const res = await fetch(`${BALE_API_BASE}${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption }),
    })
    const data = await res.json()
    if (!data.ok) throw this.makeError(data)
    return { messageId: String(data.result.message_id), raw: data.result }
  }

  private async sendVideo(token: string, chatId: string, videoUrl: string, caption: string) {
    const res = await fetch(`${BALE_API_BASE}${token}/sendVideo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, video: videoUrl, caption }),
    })
    const data = await res.json()
    if (!data.ok) throw this.makeError(data)
    return { messageId: String(data.result.message_id), raw: data.result }
  }

  private async sendDocument(token: string, chatId: string, documentUrl: string, caption: string) {
    const res = await fetch(`${BALE_API_BASE}${token}/sendDocument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, document: documentUrl, caption }),
    })
    const data = await res.json()
    if (!data.ok) throw this.makeError(data)
    return { messageId: String(data.result.message_id), raw: data.result }
  }

  private async sendMediaGroup(token: string, chatId: string, media: any[], caption: string) {
    const mediaJson = media.slice(0, 10).map((m, i) => ({
      type: m.type === 'video' ? 'video' : 'photo',
      media: m.url,
      caption: i === 0 ? caption : undefined,
    }))
    const res = await fetch(`${BALE_API_BASE}${token}/sendMediaGroup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, media: mediaJson }),
    })
    const data = await res.json()
    if (!data.ok) throw this.makeError(data)
    return { messageId: String(data.result[0].message_id), raw: data.result }
  }

  private makeError(data: any): Error {
    const err = new Error(`بله: ${data.description || 'خطای ناشناخته'}`) as any
    err.code = data.error_code
    err.retryAfter = data.parameters?.retry_after
    return err
  }
}

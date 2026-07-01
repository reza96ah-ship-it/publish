/**
 * Telegram Bot API adapter — REAL implementation.
 *
 * Official docs: https://core.telegram.org/bots/api
 * URL pattern: https://api.telegram.org/bot<TOKEN>/<METHOD>
 *
 * Auth: Bot token from @BotFather.
 * Rate limits: 30 msg/sec global, 1 msg/sec per chat, 20 msg/min per group.
 * Formatting: MarkdownV2, HTML.
 *
 * To post to a channel: add bot as admin with "Post Messages" permission,
 * then use @channelusername or channel chat_id as the target.
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
import { fetchWithTimeout, FetchTimeoutError } from '../lib/fetch-with-timeout'

// Issue #115: Telegram has TWO distinct limits — text-only messages (sendMessage)
// allow 4096 chars, but media captions (sendPhoto/sendVideo/sendDocument) cap
// at 1024. The previous code used 4096 for everything, so captions >1024 were
// silently rejected by Telegram's API.
// Source: https://core.telegram.org/bots/api#sendphoto (caption: 0-1024 characters)
const TG_LIMITS = {
  text: 4096,
  photo_caption: 1024,
  video_caption: 1024,
  document_caption: 1024,
} as const
const TG_API_BASE = 'https://api.telegram.org/bot'

/**
 * Issue #115: Escape user content for Telegram parse_mode=HTML.
 * Telegram HTML mode renders <b>, <i>, <a>, etc. User content with angle
 * brackets would inject formatting (e.g. a post containing "<b>" renders bold).
 * Must escape: & < >
 * Telegram also supports &apos; &quot; but those are only needed inside attributes.
 * Source: https://core.telegram.org/bots/api#html-style
 */
function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export class TelegramAdapter implements ChannelAdapter {
  readonly platform: PlatformType = 'telegram'

  async healthCheck(account: AdapterAccount): Promise<HealthResult> {
    const token = account.token
    if (!token) {
      return { healthy: false, status: 'disconnected', lastError: 'توکن ربات تنظیم نشده است' }
    }
    try {
      const res = await fetchWithTimeout(`${TG_API_BASE}${token}/getMe`)
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
      return { healthy: false, status: 'error', lastError: 'خطای شبکه در بررسی وضعیت ربات' }
    }
  }

  async validateReadiness(
    content: AdapterContent,
    account: AdapterAccount
  ): Promise<ReadinessResult> {
    const issues = []
    const text = content.body ?? ''
    // Issue #115: use capability registry as single source of truth.
    // Media posts use caption limit (1024), text-only use text limit (4096).
    const cap = getCapabilities('telegram')
    const isMediaPost = (content.mediaItems?.length ?? 0) > 0
    const limit = isMediaPost ? cap.maxCaptionLength : cap.maxTextLength
    if (text.length > limit) {
      issues.push({
        code: 'caption_too_long',
        message: `متن پیام تلگرام نباید از ${limit} کاراکتر بیشتر باشد${isMediaPost ? ' (کپشن رسانه)' : ''}.`,
        platform: 'telegram',
      })
    }
    if (!account.token) {
      issues.push({
        code: 'token_missing',
        message: 'توکن ربات تلگرام تنظیم نشده است.',
        platform: 'telegram',
      })
    }
    if (!account.targetId && !account.username) {
      issues.push({
        code: 'target_missing',
        message: 'شناسه چت یا نام کاربری کانال تنظیم نشده است.',
        platform: 'telegram',
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
        error: 'توکن ربات تلگرام تنظیم نشده است. لطفاً در تنظیمات پلتفرم، توکن را وارد کنید.',
        retryable: false,
        errorCategory: 'auth',
        steps: [{ label: 'بررسی توکن', at: now }],
      }
    }

    if (!chatId) {
      return {
        externalId: null,
        rawResponse: {},
        status: 'action',
        error: 'شناسه چت یا نام کاربری کانال تنظیم نشده است.',
        retryable: false,
        steps: [{ label: 'بررسی مقصد', at: now }],
      }
    }

    // Build caption: title + body + hashtags
    const rawCaption = platformCaption || this.buildCaption(content)
    const mediaItems = content.mediaItems || []

    // Issue #115: enforce caption limit BEFORE calling Telegram API.
    // Media posts: 1024 chars. Text-only: 4096. Return early with a clear
    // Persian error instead of letting Telegram reject it with an English message.
    const isMediaPost = mediaItems.length > 0
    const captionLimit = isMediaPost ? TG_LIMITS.photo_caption : TG_LIMITS.text
    if (rawCaption.length > captionLimit) {
      return {
        externalId: null,
        rawResponse: {},
        status: 'action',
        error: `متن تلگرام بیش از حد مجاز است (${rawCaption.length}/${captionLimit}). ${isMediaPost ? 'کپشن رسانه حداکثر ۱۰۲۴ کاراکتر است.' : 'متن پیام حداکثر ۴۰۹۶ کاراکتر است.'}`,
        retryable: false,
        steps: [{ label: 'بررسی طول متن', at: now }],
      }
    }

    // Issue #115: escape user content for parse_mode=HTML to prevent injection.
    // User content with <b>, <i>, <a> tags would render as formatting otherwise.
    const caption = escapeTelegramHtml(rawCaption)

    try {
      let result: { messageId: string; raw: any }

      if (mediaItems.length === 0) {
        // Text-only message
        result = await this.sendMessage(token, chatId, caption)
      } else if (mediaItems.length === 1) {
        // Single media — noUncheckedIndexedAccess: guard against undefined
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
          { label: 'ارسال به تلگرام', at: now },
          { label: 'منتشر شد', at: Date.now() },
        ],
      }
    } catch (err: any) {
      // Issue #147 D: a request timeout means we don't know if Telegram
      // received the message — treat as an ambiguous outcome, not a plain
      // retryable failure (avoids creating a duplicate post on retry).
      if (err instanceof FetchTimeoutError) {
        return {
          externalId: null,
          rawResponse: { error: err.message },
          status: 'failed',
          error: 'پاسخ تلگرام در زمان مقرر دریافت نشد. وضعیت ارسال نامشخص است.',
          retryable: false,
          errorCategory: 'network',
          outcomeUnknown: true,
          steps: [
            { label: 'ارسال به تلگرام', at: now },
            { label: 'خطا', at: Date.now() },
          ],
        }
      }

      // Issue #147 A: classify Telegram's error_code into a typed
      // ErrorCategory instead of leaving it unset (previously only
      // LinkedIn/Instagram populated this, so Telegram's permission/
      // validation errors fell into the generic retry branch).
      const code = err.code
      let errorCategory: ErrorCategory = 'unknown'
      if (code === 401 || code === 403) errorCategory = 'auth'
      else if (code === 429) errorCategory = 'rate_limit'
      else if (code === 404) errorCategory = 'not_found'
      else if (typeof code === 'number' && code >= 500) errorCategory = 'network'
      const retryable = errorCategory === 'rate_limit' || errorCategory === 'network'
      // Telegram returns retry_after (seconds) in parameters on 429 — honor it.
      const retryAfterMs = typeof err.retryAfter === 'number' ? err.retryAfter * 1000 : undefined

      return {
        externalId: null,
        rawResponse: { error: err.message, code: err.code },
        status: retryable ? 'failed' : 'action',
        error: err.message,
        retryable,
        errorCategory,
        ...(retryAfterMs ? { retryAfterMs } : {}),
        steps: [
          { label: 'ارسال به تلگرام', at: now },
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
    const res = await fetchWithTimeout(`${TG_API_BASE}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: false },
      }),
    })
    const data = await res.json()
    if (!data.ok) throw this.makeError(data)
    return { messageId: String(data.result.message_id), raw: data.result }
  }

  private async sendPhoto(token: string, chatId: string, photoUrl: string, caption: string) {
    const res = await fetchWithTimeout(`${TG_API_BASE}${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: 'HTML',
      }),
    })
    const data = await res.json()
    if (!data.ok) throw this.makeError(data)
    return { messageId: String(data.result.message_id), raw: data.result }
  }

  private async sendVideo(token: string, chatId: string, videoUrl: string, caption: string) {
    const res = await fetchWithTimeout(`${TG_API_BASE}${token}/sendVideo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        video: videoUrl,
        caption,
        parse_mode: 'HTML',
      }),
    })
    const data = await res.json()
    if (!data.ok) throw this.makeError(data)
    return { messageId: String(data.result.message_id), raw: data.result }
  }

  private async sendDocument(token: string, chatId: string, documentUrl: string, caption: string) {
    const res = await fetchWithTimeout(`${TG_API_BASE}${token}/sendDocument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        document: documentUrl,
        caption,
        parse_mode: 'HTML',
      }),
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
      parse_mode: 'HTML',
    }))
    const res = await fetchWithTimeout(`${TG_API_BASE}${token}/sendMediaGroup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, media: mediaJson }),
    })
    const data = await res.json()
    if (!data.ok) throw this.makeError(data)
    // MediaGroup returns array of messages; use first message_id
    return { messageId: String(data.result[0].message_id), raw: data.result }
  }

  private makeError(data: any): Error {
    const err = new Error(`تلگرام: ${data.description || 'خطای ناشناخته'}`) as any
    err.code = data.error_code
    err.retryAfter = data.parameters?.retry_after
    return err
  }
}

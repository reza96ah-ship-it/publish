/**
 * Rubika Bot API adapter — REAL implementation.
 *
 * Official docs: https://rubika.ir/botapi
 * URL pattern: https://botapi.rubika.ir/v3/{token}/{method} (always POST)
 *
 * Auth: Bot token from @BotFather in Rubika app.
 *
 * Methods (per official docs):
 *   - getMe: bot info
 *   - sendMessage: send text (chat_id, text, reply_to_message_id)
 *   - sendPoll: send poll
 *   - getUpdates: long-polling for updates (use start_id for pagination)
 *   - updateBotEndpoint: set webhook for real-time updates
 *
 * To add bot to channel: go to channel → "add member" → add bot → set as admin → save.
 * Limitations (per official docs):
 *   - Limited bot access to messages
 *   - Limited editing capability
 *   - Cannot add bot via invite link
 *   - Limited number of admin bots per chat
 *
 * Note: Rubika's public bot API v3 is primarily text-based. Media upload methods
 * are not in the public docs yet — this adapter sends text-only for now.
 * If media is provided, it sends the caption text and notes media is unsupported.
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

const RUBIKA_TEXT_LIMIT = 4096
const RUBIKA_API_BASE = 'https://botapi.rubika.ir/v3'

export class RubikaAdapter implements ChannelAdapter {
  readonly platform: PlatformType = 'rubika'

  async healthCheck(account: AdapterAccount): Promise<HealthResult> {
    const token = account.token
    if (!token) {
      return {
        healthy: false,
        status: 'disconnected',
        lastError: 'توکن ربات روبیکا تنظیم نشده است',
      }
    }
    try {
      const res = await fetch(`${RUBIKA_API_BASE}/${token}/getMe`, { method: 'POST' })
      const data = await res.json()
      if (data.status !== 'OK' && !data.ok) {
        return { healthy: false, status: 'error', lastError: data.message || 'توکن نامعتبر است' }
      }
      return { healthy: true, status: 'active', lastError: null }
    } catch (err) {
      return { healthy: false, status: 'error', lastError: 'خطای شبکه در بررسی وضعیت ربات روبیکا' }
    }
  }

  async validateReadiness(
    content: AdapterContent,
    account: AdapterAccount
  ): Promise<ReadinessResult> {
    const issues = []
    const text = content.body ?? ''
    if (text.length > RUBIKA_TEXT_LIMIT) {
      issues.push({
        code: 'caption_too_long',
        message: `متن پیام روبیکا نباید از ${RUBIKA_TEXT_LIMIT} کاراکتر بیشتر باشد.`,
        platform: 'rubika',
      })
    }
    if (!account.token) {
      issues.push({
        code: 'token_missing',
        message: 'توکن ربات روبیکا تنظیم نشده است.',
        platform: 'rubika',
      })
    }
    if (!account.targetId && !account.username) {
      issues.push({
        code: 'target_missing',
        message: 'شناسه چت روبیکا تنظیم نشده است.',
        platform: 'rubika',
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
        error: 'توکن ربات روبیکا تنظیم نشده است. لطفاً در تنظیمات پلتفرم، توکن را وارد کنید.',
        retryable: false,
        steps: [{ label: 'بررسی توکن', at: now }],
      }
    }

    if (!chatId) {
      return {
        externalId: null,
        rawResponse: {},
        status: 'action',
        error: 'شناسه چت روبیکا تنظیم نشده است.',
        retryable: false,
        steps: [{ label: 'بررسی مقصد', at: now }],
      }
    }

    const text = platformCaption || this.buildCaption(content)
    const mediaItems = content.mediaItems || []

    // Rubika v3 public API is text-only — if media provided, note it in text
    const finalText =
      mediaItems.length > 0
        ? `${text}\n\n📎 (${mediaItems.length} رسانه پیوست شده — پشتیبانی کامل از رسانه به‌زودی)`
        : text

    try {
      const res = await fetch(`${RUBIKA_API_BASE}/${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: finalText,
        }),
      })
      const data = await res.json()

      // Rubika returns { status: 'OK', data: { message_id, ... } } or { status: 'ERROR', message: '...' }
      if (data.status === 'OK' || data.ok) {
        const messageId = String(data.data?.message_id ?? data.message_id ?? '')
        return {
          externalId: messageId,
          rawResponse: data,
          status: 'success',
          error: null,
          retryable: false,
          steps: [
            { label: 'ارسال به روبیکا', at: now },
            { label: 'منتشر شد', at: Date.now() },
          ],
        }
      }

      // Error
      const errorMsg = data.message || data.description || 'خطای ناشناخته روبیکا'
      const retryable = data.code === 429 || (data.code && data.code >= 500)
      return {
        externalId: null,
        rawResponse: data,
        status: retryable ? 'failed' : 'action',
        error: `روبیکا: ${errorMsg}`,
        retryable,
        steps: [
          { label: 'ارسال به روبیکا', at: now },
          { label: 'خطا', at: Date.now() },
        ],
      }
    } catch (err: any) {
      return {
        externalId: null,
        rawResponse: { error: err.message },
        status: 'failed',
        error: `روبیکا: خطای شبکه — ${err.message}`,
        retryable: true, // network errors are retryable
        steps: [
          { label: 'ارسال به روبیکا', at: now },
          { label: 'خطا', at: Date.now() },
        ],
      }
    }
  }

  private buildCaption(content: AdapterContent): string {
    const parts = [content.title, content.body, content.hashtags].filter(Boolean)
    return parts.join('\n\n')
  }
}

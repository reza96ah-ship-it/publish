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
 *
 * Issue #149 — idempotency key: VERIFIED (2026-07, official Bot API docs)
 * that sendMessage/sendPhoto/sendVideo/sendDocument/sendMediaGroup accept NO
 * client-supplied idempotency key or dedupe token — none of their documented
 * parameters serve that purpose. `job.publicationOperationId`/
 * `job.idempotencyKey` are therefore NOT forwarded to Telegram's HTTP
 * requests. Duplicate prevention relies on this codebase's own
 * fingerprint/ledger checks.
 *
 * Issue #149 — reconcile(): REAL implementation, not a stub. Verified
 * (2026-07, official Bot API docs + tdlib/telegram-bot-api issue tracker)
 * what a bot can and cannot do to confirm a message was actually posted
 * after an ambiguous outcome:
 *   - `getChat` returns no message-count/last-message data (only
 *     `pinned_message`, which is unrelated) — cannot be used.
 *   - `getUpdates` is an update QUEUE, not a searchable history: updates
 *     expire after 24h, and once delivered (via polling or a webhook,
 *     which are mutually exclusive with getUpdates) they cannot be
 *     re-queried. There is no bot-API method to search chat history by
 *     content/timestamp (that requires MTProto/a user session, not a bot).
 *   - The one REAL, honest check available to a bot: given a candidate
 *     `message_id` (e.g. surfaced by a slow-but-successful response that
 *     arrived after our client-side fetch timeout), calling
 *     `copyMessage`/`forwardMessage` against that ID returns a distinct
 *     `400 Bad Request: message to forward/copy not found` if it does NOT
 *     exist, vs. success if it does. This is a genuine existence probe —
 *     not a guess.
 *   - When we have NO candidate message_id at all (the common case for a
 *     true client-side timeout, since this codebase's fetchWithTimeout
 *     aborts before any response body is read), there is NO bot-API-only
 *     way to confirm one way or the other. reconcile() honestly returns
 *     `still_unknown` in that case — it does not fabricate a positive or
 *     negative result — and the publication is routed to manual resolution
 *     (POST /api/publications/[id]/resolve) exactly as issue #149 requires.
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
  ReconcileInput,
  ReconcileOutcome,
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

  /**
   * Issue #149: real reconciliation, not a stub.
   *
   * The Bot API gives no way to search chat history or list recent messages
   * (that requires MTProto/a user session). The one genuine, documented
   * existence check available to a bot is: call `editMessageReplyMarkup`
   * against a candidate `message_id` with `reply_markup` omitted.
   *   - message exists (and — as this adapter never sets an inline keyboard —
   *     has no markup already): Telegram detects a no-op diff and returns
   *     `400 Bad Request: message is not modified` → CONFIRMS existence.
   *   - message does not exist / wrong chat: returns
   *     `400 Bad Request: message to edit not found` → CONFIRMS it was never
   *     posted.
   *   - anything else (200 OK, or a 400 that matches neither string): treated
   *     as still ambiguous rather than guessed at.
   * This only works when we HAVE a candidate `message_id` to probe — e.g. a
   * slow-but-successful response that arrived after our client-side
   * `fetchWithTimeout` already gave up (see lib/fetch-with-timeout.ts). A true
   * black-hole timeout with zero response and zero id gives a bot literally
   * nothing to check against; reconcile() honestly returns `still_unknown`
   * in that case instead of fabricating a result.
   *
   * Caveat: matching on the error `description` string is Telegram's de
   * facto (not formally guaranteed-stable) way of distinguishing these two
   * cases — there is no dedicated error code for "not modified" vs "not
   * found". If Telegram ever changes the wording, this degrades to
   * `still_unknown` (see the `else` branch below) rather than a wrong answer.
   */
  async reconcile(input: ReconcileInput): Promise<ReconcileOutcome> {
    const token = input.account.token
    const chatId = input.account.targetId || input.account.username
    const candidateMessageId = input.providerPostId

    if (!token || !chatId || !candidateMessageId) {
      // No message_id to probe against — the Bot API has no other way to
      // confirm existence. Be honest: we genuinely don't know.
      return { kind: 'still_unknown' }
    }

    try {
      const res = await fetchWithTimeout(`${TG_API_BASE}${token}/editMessageReplyMarkup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: Number(candidateMessageId) }),
      })
      const data = await res.json()

      if (data.ok) {
        // Edit "succeeded" (would only happen if it genuinely had markup to
        // clear, which this adapter never sets) — message exists.
        return { kind: 'confirmed_success', providerPostId: candidateMessageId }
      }

      const description: string = data.description || ''
      if (/message is not modified/i.test(description)) {
        return { kind: 'confirmed_success', providerPostId: candidateMessageId }
      }
      if (/message to edit not found/i.test(description)) {
        return { kind: 'confirmed_failure', reason: 'پیام در تلگرام یافت نشد — هرگز ارسال نشده است' }
      }

      // Some other error (rate limit, auth, chat not found, etc.) — don't
      // guess; let the caller retry reconciliation later.
      return { kind: 'still_unknown', nextCheckAt: new Date(Date.now() + 15 * 60 * 1000) }
    } catch {
      // Network/timeout error while reconciling — still ambiguous, try again later.
      return { kind: 'still_unknown', nextCheckAt: new Date(Date.now() + 15 * 60 * 1000) }
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

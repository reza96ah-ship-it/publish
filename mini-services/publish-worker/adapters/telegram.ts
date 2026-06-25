/**
 * Telegram Bot API adapter — api.telegram.org/bot<token>/sendMessage.
 * Mock mode simulates the API with low failure rate (Telegram is very reliable).
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

const TG_TEXT_LIMIT = 4096
const SIMULATED_FAILURE_RATE = 0.02 // 2% — Telegram is the most reliable

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function mockFail(): boolean {
  return Math.random() < SIMULATED_FAILURE_RATE
}

export class TelegramAdapter implements ChannelAdapter {
  readonly platform: PlatformType = 'telegram'

  async healthCheck(account: AdapterAccount): Promise<HealthResult> {
    await sleep(150)
    if (account.status === 'disconnected') {
      return { healthy: false, status: 'disconnected', lastError: 'ربات تلگرام متصل نیست' }
    }
    return { healthy: true, status: 'active', lastError: null }
  }

  async validateReadiness(content: AdapterContent, _account: AdapterAccount): Promise<ReadinessResult> {
    const issues = []
    const text = content.body ?? ''
    if (text.length > TG_TEXT_LIMIT) {
      issues.push({
        code: 'caption_too_long',
        message: `متن پیام تلگرام نباید از ${TG_TEXT_LIMIT} کاراکتر بیشتر باشد.`,
        platform: 'telegram',
      })
    }
    return { ready: issues.length === 0, issues }
  }

  async publish(job: AdapterJob): Promise<PublishResult> {
    const now = Date.now()
    const text = job.platformCaption || [job.content.title, job.content.body, job.content.hashtags].filter(Boolean).join('\n\n')

    await sleep(400)
    if (mockFail()) {
      return {
        externalId: null,
        rawResponse: { step: 'sendMessage', ok: false },
        status: 'failed',
        error: 'خطای موقت در ارتباط با سرور تلگرام (۴۲۹).',
        retryable: true,
        steps: [
          { label: 'ارسال پیام به تلگرام', at: now },
          { label: 'خطا', at: Date.now() },
        ],
      }
    }

    const messageId = Math.floor(Math.random() * 1000000)
    return {
      externalId: String(messageId),
      rawResponse: { step: 'sendMessage', messageId, chatId: '@nashrino_channel' },
      status: 'success',
      error: null,
      retryable: false,
      steps: [
        { label: 'ارسال پیام به تلگرام', at: now },
        { label: 'منتشر شد', at: Date.now() },
      ],
    }
  }
}

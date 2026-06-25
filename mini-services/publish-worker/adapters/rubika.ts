/**
 * Rubika Bot API adapter — botapi.rubika.ir/v3.
 * Mock mode simulates sendMessage/sendFile with realistic failure modes.
 * Rubika is a Persian super-app; this is a key strategic moat for Nashrino.
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
const SIMULATED_FAILURE_RATE = 0.10 // 10% — Rubika API is flakier than IG

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function mockFail(): boolean {
  return Math.random() < SIMULATED_FAILURE_RATE
}

export class RubikaAdapter implements ChannelAdapter {
  readonly platform: PlatformType = 'rubika'

  async healthCheck(account: AdapterAccount): Promise<HealthResult> {
    await sleep(200)
    if (account.status === 'error' || account.circuitState === 'open') {
      return { healthy: false, status: 'error', lastError: 'اختلال API روبیکا (خطای سرور ۵۰۰)' }
    }
    return { healthy: true, status: 'active', lastError: null }
  }

  async validateReadiness(content: AdapterContent, _account: AdapterAccount): Promise<ReadinessResult> {
    const issues = []
    const text = content.body ?? ''
    if (text.length > RUBIKA_TEXT_LIMIT) {
      issues.push({
        code: 'caption_too_long',
        message: `متن پیام روبیکا نباید از ${RUBIKA_TEXT_LIMIT} کاراکتر بیشتر باشد.`,
        platform: 'rubika',
      })
    }
    return { ready: issues.length === 0, issues }
  }

  async publish(job: AdapterJob): Promise<PublishResult> {
    const now = Date.now()
    const text = job.platformCaption || [job.content.title, job.content.body, job.content.hashtags].filter(Boolean).join('\n\n')

    // Single-step: bot.sendMessage
    await sleep(600) // simulate POST /v3/bot/sendMessage
    if (mockFail()) {
      return {
        externalId: null,
        rawResponse: { step: 'sendMessage', ok: false },
        status: 'failed',
        error: 'خطای سرور روبیکا (۵۰۰). تلاش مجدد انجام خواهد شد.',
        retryable: true,
        steps: [
          { label: 'ارسال پیام به روبیکا', at: now },
          { label: 'خطای سرور', at: Date.now() },
        ],
      }
    }

    const messageId = `rubika_msg_${Date.now()}`
    return {
      externalId: messageId,
      rawResponse: {
        step: 'sendMessage',
        messageId,
        textLength: text.length,
      },
      status: 'success',
      error: null,
      retryable: false,
      steps: [
        { label: 'ارسال پیام به روبیکا', at: now },
        { label: 'منتشر شد', at: Date.now() },
      ],
    }
  }
}

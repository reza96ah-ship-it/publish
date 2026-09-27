import type {
  AdapterAccount,
  AdapterContent,
  AdapterJob,
  ChannelAdapter,
  HealthResult,
  PublishResult,
  ReadinessResult,
  ReconcileInput,
  ReconcileOutcome,
} from './types'

const OBJECT_ID = /^[a-f\d]{24}$/i

/** The existing local queue owns scheduling; Zernio only performs the due publish. */
export class ZernioInstagramAdapter implements ChannelAdapter {
  readonly platform = 'instagram' as const

  async healthCheck(account: AdapterAccount): Promise<HealthResult> {
    const ready = Boolean(process.env.ZERNIO_API_KEY && account.providerAccountId && OBJECT_ID.test(account.providerAccountId))
    return {
      healthy: ready,
      status: ready ? 'active' : 'disconnected',
      lastError: ready ? null : 'حساب Zernio یا کلید API در سرویس انتشار تنظیم نشده است',
    }
  }

  async validateReadiness(content: AdapterContent, account: AdapterAccount): Promise<ReadinessResult> {
    const issues = []
    if (!process.env.ZERNIO_API_KEY || !account.providerAccountId || !OBJECT_ID.test(account.providerAccountId)) {
      issues.push({ code: 'account_not_connected', message: 'اتصال Zernio برای این حساب آماده نیست.', platform: 'instagram' })
    }
    if (!content.mediaItems?.length) {
      issues.push({ code: 'media_missing', message: 'اینستاگرام به تصویر یا ویدیو نیاز دارد.', platform: 'instagram' })
    }
    if (content.mediaItems?.some((media) => media.type === 'document' || !media.url.startsWith('https://'))) {
      issues.push({ code: 'unsupported_media', message: 'رسانه اینستاگرام باید تصویر/ویدیو با آدرس HTTPS عمومی باشد.', platform: 'instagram' })
    }
    return { ready: issues.length === 0, issues }
  }

  async publish(job: AdapterJob): Promise<PublishResult> {
    const readiness = await this.validateReadiness(job.content, job.account)
    if (!readiness.ready) return this.failure(readiness.issues[0]?.message ?? 'انتشار آماده نیست', 'auth', false)

    const caption = job.platformCaption ?? [job.content.body || job.content.title, job.content.hashtags].filter(Boolean).join('\n\n')
    if (caption.length > 2200) return this.failure('کپشن اینستاگرام بیش از ۲۲۰۰ کاراکتر است.', 'unknown', false)
    const mediaItems = job.content.mediaItems!.map((media) => ({
      type: media.type === 'photo' ? 'image' : 'video',
      url: media.url,
    }))
    if (mediaItems.length > 10) return this.failure('هر پست اینستاگرام حداکثر ۱۰ رسانه دارد.', 'unknown', false)

    try {
      const response = await fetch('https://zernio.com/api/v1/posts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Idempotency-Key': job.publicationOperationId || job.idempotencyKey,
        },
        body: JSON.stringify({
          content: caption,
          mediaItems,
          platforms: [{ platform: 'instagram', accountId: job.account.providerAccountId }],
          publishNow: true,
        }),
        signal: AbortSignal.timeout(120_000),
      })
      const payload: unknown = await response.json().catch(() => null)
      const body = asObject(payload)
      const post = asObject(body?.post)
      const platform = Array.isArray(post?.platforms) ? asObject(post.platforms[0]) : null
      const platformPostId = platform?.platformPostId
      if (response.ok && post?.status === 'published' && platform?.status === 'published' && typeof platformPostId === 'string' && platformPostId) {
        return { externalId: platformPostId, rawResponse: { providerPostId: post._id ?? null }, status: 'success', error: null, retryable: false }
      }
      if (response.status === 409 && body?.code === 'idempotency_conflict') {
        return this.failure('درخواست انتشار قبلی هنوز در Zernio در حال پردازش است.', 'rate_limit', true)
      }
      if (response.status === 401 || response.status === 403) {
        return this.failure('کلید API یا دسترسی Zernio معتبر نیست.', 'auth', false)
      }
      if (response.status === 429 || response.status >= 500) {
        return this.failure('Zernio موقتاً در دسترس نیست؛ تلاش با همان کلید تکرار می‌شود.', response.status === 429 ? 'rate_limit' : 'network', true)
      }
      if (response.ok && post?._id) {
        return { ...this.failure('وضعیت پست در Zernio هنوز منتشرشده تأیید نشده است.', 'unknown', false), outcomeUnknown: true, rawResponse: { providerPostId: post._id } }
      }
      return this.failure('Zernio انتشار این پست را نپذیرفت. رسانه و دسترسی حساب را بررسی کنید.', 'unknown', false)
    } catch {
      return { ...this.failure('پاسخ Zernio نامشخص است؛ برای جلوگیری از انتشار تکراری تلاش خودکار متوقف شد.', 'network', false), outcomeUnknown: true }
    }
  }

  async reconcile(_input: ReconcileInput): Promise<ReconcileOutcome> {
    // Without a provider post id, querying a recent-post list cannot prove
    // whether this particular operation succeeded. Keep it for manual review.
    return { kind: 'still_unknown' }
  }

  private failure(message: string, category: 'auth' | 'rate_limit' | 'network' | 'unknown', retryable: boolean): PublishResult {
    return { externalId: null, rawResponse: {}, status: 'failed', error: message, retryable, errorCategory: category }
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

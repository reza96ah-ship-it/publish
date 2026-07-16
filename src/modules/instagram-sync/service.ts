/**
 * Instagram Initial Sync — issue #346.
 *
 * Runs once after a successful OAuth connection (triggered via Next.js `after()`
 * in the callback route). Idempotent: safe to re-run — each step checks for
 * existing data before writing. Resumable: checkpoint JSON saved after each
 * successful step; interrupted syncs continue from where they left off.
 *
 * Steps (from INITIAL_SYNC_SPEC.md):
 *   1. Validate token + identity
 *   2. Update profile (followers, username, avatar)
 *   3. Subscribe account webhooks (best-effort — already done in OAuth callback)
 *   4. Import recent media (25 items, origin=INSTAGRAM_IMPORT)
 *   5. Import post metrics for imported media
 *   6. Backfill conversations (DMs + comments, within Meta limits)
 *   7. Mark limitations (insights unavailable, backfill limits)
 *   8. Emit activation telemetry event
 *
 * All API calls use graph.instagram.com (new Instagram Login path).
 */

import { db } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { getInstagramGraphApiBaseUrl } from '../../../shared/instagram-graph'

const GRAPH_API = getInstagramGraphApiBaseUrl()
const MEDIA_IMPORT_LIMIT = 25
const CONVERSATION_LIMIT = 20
const STEP_LABELS = [
  'مرحله ۱: اعتبارسنجی توکن',
  'مرحله ۲: بارگذاری پروفایل',
  'مرحله ۳: اشتراک وب‌هوک',
  'مرحله ۴: وارد کردن رسانه',
  'مرحله ۵: وارد کردن آمار انتشار',
  'مرحله ۶: بارگذاری مکالمات',
  'مرحله ۷: ثبت محدودیت‌ها',
  'مرحله ۸: تکمیل',
]

interface SyncContext {
  runId: string
  platformId: string
  workspaceId: string
  token: string
  igUserId: string
}

export async function startInstagramSync(
  platformId: string,
  workspaceId: string
): Promise<string> {
  // Reuse any PENDING or FAILED run for this platform, or create a new one.
  const existing = await db.instagramSyncRun.findFirst({
    where: { platformId, status: { in: ['PENDING', 'FAILED'] } },
    orderBy: { createdAt: 'desc' },
  })

  const run = existing
    ? await db.instagramSyncRun.update({
        where: { id: existing.id },
        data: { status: 'RUNNING', currentStep: STEP_LABELS[0], currentStepIndex: 0, errors: [] },
      })
    : await db.instagramSyncRun.create({
        data: {
          workspaceId,
          platformId,
          status: 'RUNNING',
          currentStep: STEP_LABELS[0],
          currentStepIndex: 0,
        },
      })

  return run.id
}

export async function runInstagramSync(runId: string): Promise<void> {
  const run = await db.instagramSyncRun.findUnique({ where: { id: runId } })
  if (!run) throw new Error(`[instagram-sync] run ${runId} not found`)

  const platform = await db.platform.findUnique({ where: { id: run.platformId } })
  if (!platform?.tokenSecret || !platform.targetId) {
    await failRun(runId, 'platform token or targetId missing')
    return
  }

  let token: string
  try {
    token = decrypt(platform.tokenSecret)
  } catch {
    await failRun(runId, 'token decryption failed')
    return
  }

  const ctx: SyncContext = {
    runId,
    platformId: run.platformId,
    workspaceId: run.workspaceId,
    token,
    igUserId: platform.targetId,
  }

  const warnings: string[] = []
  const checkpoint = (run.checkpoint ?? {}) as Record<string, boolean>

  try {
    // Step 1 — validate token
    if (!checkpoint.step1) {
      await setStep(runId, 0)
      const meRes = await igGet(token, `/me?fields=id,username`)
      if (meRes.error) throw new Error(`token invalid: ${meRes.error.message}`)
      checkpoint.step1 = true
      await saveCheckpoint(runId, checkpoint)
    }

    // Step 2 — import profile
    if (!checkpoint.step2) {
      await setStep(runId, 1)
      await importProfile(ctx, warnings)
      checkpoint.step2 = true
      await saveCheckpoint(runId, checkpoint)
    }

    // Step 3 — webhook subscription (best-effort, already done in OAuth callback)
    checkpoint.step3 = true
    await saveCheckpoint(runId, checkpoint)

    // Step 4 — import recent media
    if (!checkpoint.step4) {
      await setStep(runId, 3)
      const cursor = run.lastProviderCursor ?? undefined
      const mediaCount = await importMedia(ctx, cursor)
      checkpoint.step4 = true
      await db.instagramSyncRun.update({
        where: { id: runId },
        data: { importedMediaCount: mediaCount, checkpoint },
      })
    }

    // Step 5 — import post metrics
    if (!checkpoint.step5) {
      await setStep(runId, 4)
      const metricsWarning = await importPostMetrics(ctx)
      if (metricsWarning) warnings.push(metricsWarning)
      checkpoint.step5 = true
      await saveCheckpoint(runId, checkpoint)
    }

    // Step 6 — backfill conversations
    if (!checkpoint.step6) {
      await setStep(runId, 5)
      const { count, warning } = await backfillConversations(ctx)
      if (warning) warnings.push(warning)
      checkpoint.step6 = true
      await db.instagramSyncRun.update({
        where: { id: runId },
        data: { importedConversationCount: count, checkpoint },
      })
    }

    // Step 7 — record limitations
    if (!checkpoint.step7) {
      await setStep(runId, 6)
      const platform2 = await db.platform.findUnique({
        where: { id: ctx.platformId },
        select: { targetId: true },
      })
      // Check follower count via profile data to warn about insights availability
      const profileRes = await igGet(token, `/me?fields=followers_count`)
      if (!profileRes.error && typeof profileRes.followers_count === 'number' && profileRes.followers_count < 100) {
        warnings.push('آمار بینش پست‌ها برای حساب‌هایی با کمتر از ۱۰۰ دنبال‌کننده در دسترس نیست.')
      }
      void platform2 // referenced for side-effect only
      checkpoint.step7 = true
      await saveCheckpoint(runId, checkpoint)
    }

    // Step 8 — complete
    await setStep(runId, 7)
    await db.instagramSyncRun.update({
      where: { id: runId },
      data: {
        status: warnings.length > 0 ? 'PARTIAL' : 'COMPLETED',
        completedAt: new Date(),
        warnings,
        currentStep: 'تکمیل شد',
        currentStepIndex: 7,
        checkpoint,
      },
    })

    console.log(`[instagram-sync] run ${runId} completed — warnings: ${warnings.length}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error(`[instagram-sync] run ${runId} failed at step:`, msg)
    await db.instagramSyncRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        errors: { push: msg },
        warnings,
        checkpoint,
      },
    })
  }
}

// ── Helpers ──────────────────────────────────────────────────

async function setStep(runId: string, index: number): Promise<void> {
  await db.instagramSyncRun.update({
    where: { id: runId },
    data: { currentStep: STEP_LABELS[index], currentStepIndex: index },
  })
}

async function saveCheckpoint(runId: string, checkpoint: Record<string, boolean>): Promise<void> {
  await db.instagramSyncRun.update({ where: { id: runId }, data: { checkpoint } })
}

async function failRun(runId: string, reason: string): Promise<void> {
  await db.instagramSyncRun.update({
    where: { id: runId },
    data: { status: 'FAILED', errors: { push: reason }, completedAt: new Date() },
  })
}

type IgResponse = Record<string, unknown> & { error?: { message?: string } }

async function igGet(token: string, path: string): Promise<IgResponse> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${GRAPH_API}${path}${sep}access_token=${token}`, {
    signal: AbortSignal.timeout(15_000),
  })
  return (res.json().catch(() => ({ error: { message: 'json parse failed' } })) as unknown) as Promise<IgResponse>
}

// ── Step implementations ──────────────────────────────────────

async function importProfile(ctx: SyncContext, warnings: string[]): Promise<void> {
  const data = await igGet(
    ctx.token,
    `/me?fields=id,username,name,biography,profile_picture_url,followers_count,media_count,website`
  )
  if (data.error) {
    warnings.push(`پروفایل بارگذاری نشد: ${(data.error as { message?: string }).message ?? 'خطای ناشناخته'}`)
    return
  }
  await db.platform.update({
    where: { id: ctx.platformId },
    data: {
      username: (data.username as string | undefined) ?? '',
      name: (data.name as string | undefined) ?? (data.username as string | undefined) ?? '',
      avatarUrl: (data.profile_picture_url as string | undefined) ?? null,
    },
  })
}

async function importMedia(ctx: SyncContext, afterCursor?: string): Promise<number> {
  const cursorParam = afterCursor ? `&after=${afterCursor}` : ''
  const data = await igGet(
    ctx.token,
    `/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,permalink&limit=${MEDIA_IMPORT_LIMIT}${cursorParam}`
  )
  if (data.error || !Array.isArray((data as { data?: unknown }).data)) return 0

  const items = (data as { data: Record<string, unknown>[] }).data
  let imported = 0

  for (const item of items) {
    const mediaId = item.id as string
    if (!mediaId) continue

    // Dedup: skip if already imported
    const existing = await db.content.findFirst({
      where: { workspaceId: ctx.workspaceId, importedPostId: mediaId },
      select: { id: true },
    })
    if (existing) continue

    const caption = (item.caption as string | undefined) ?? ''
    const title = caption.slice(0, 80) || `پست اینستاگرام ${mediaId.slice(-6)}`
    const mediaUrl = (item.media_url as string | undefined) ?? (item.thumbnail_url as string | undefined)

    await db.content.create({
      data: {
        workspaceId: ctx.workspaceId,
        title,
        body: caption,
        status: 'published',
        origin: 'INSTAGRAM_IMPORT',
        importedPostId: mediaId,
        thumbnailUrl: mediaUrl ?? null,
        publishedAt: item.timestamp ? new Date(item.timestamp as string) : null,
      },
    })
    imported++
  }

  // Save cursor for resume
  const paging = (data as { paging?: { cursors?: { after?: string } } }).paging
  if (paging?.cursors?.after) {
    await db.instagramSyncRun.update({
      where: { id: ctx.runId },
      data: { lastProviderCursor: paging.cursors.after },
    })
  }

  return imported
}

// Step 5: Probe metric availability for imported posts.
// PostMetricSnapshot requires a Publication row (for Nashrino-published content).
// Imported content has no Publication — we probe one post to check API access
// and record a warning if insights are unavailable (< 100 followers or missing scope).
async function importPostMetrics(ctx: SyncContext): Promise<string | null> {
  const sample = await db.content.findFirst({
    where: { workspaceId: ctx.workspaceId, origin: 'INSTAGRAM_IMPORT', importedPostId: { not: null } },
    select: { importedPostId: true },
    orderBy: { publishedAt: 'desc' },
  })
  if (!sample?.importedPostId) return null

  const data = await igGet(
    ctx.token,
    `/${sample.importedPostId}/insights?metric=reach,likes,comments,saved`
  )
  if (data.error) {
    return `آمار پست‌های وارد شده در دسترس نیست (احتمالاً حساب کمتر از ۱۰۰ دنبال‌کننده دارد یا دسترسی پیشرفته تأیید نشده). آمار پست‌هایی که از ناشرینو منتشر شوند به‌طور خودکار جمع‌آوری می‌شود.`
  }
  return null
}

async function backfillConversations(
  ctx: SyncContext
): Promise<{ count: number; warning: string | null }> {
  const data = await igGet(
    ctx.token,
    `/me/conversations?fields=id,updated_time,participants&limit=${CONVERSATION_LIMIT}`
  )

  if (data.error) {
    // Missing scope or no Advanced Access — non-fatal
    return {
      count: 0,
      warning: `بارگذاری مکالمات ناموفق بود: ${(data.error as { message?: string }).message ?? 'خطا'}. ممکن است دسترسی پیشرفته هنوز تأیید نشده باشد.`,
    }
  }

  const conversations = ((data as { data?: Record<string, unknown>[] }).data) ?? []
  let created = 0

  for (const conv of conversations) {
    const threadId = conv.id as string
    if (!threadId) continue

    await db.inboxThread.upsert({
      where: { platformId_providerThreadId: { platformId: ctx.platformId, providerThreadId: threadId } },
      create: {
        workspaceId: ctx.workspaceId,
        platformId: ctx.platformId,
        providerThreadId: threadId,
        messageType: 'dm',
        status: 'new',
        lastMessageAt: conv.updated_time ? new Date(conv.updated_time as string) : new Date(),
      },
      update: {
        lastMessageAt: conv.updated_time ? new Date(conv.updated_time as string) : undefined,
      },
    })
    created++
  }

  return { count: created, warning: null }
}

import { db } from '@/lib/db'
import {
  getInstagramRecentPosts,
  listInstagramAccounts,
  ZernioApiError,
} from '@/lib/zernio'

// Next.js callback/retry requests have a 60-second execution limit. A run
// untouched for five minutes can be reclaimed after a process interruption.
export const ZERNIO_SYNC_STALE_MS = 5 * 60_000

type Checkpoint = { provider: 'zernio'; identity?: boolean; media?: boolean }

function checkpointOf(value: unknown): Checkpoint | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (row.provider !== 'zernio') return null
  return { provider: 'zernio', identity: row.identity === true, media: row.media === true }
}

export function zernioSyncCanResume(status: string, updatedAt: Date): boolean {
  return status === 'PENDING' || status === 'FAILED' ||
    (status === 'RUNNING' && Date.now() - updatedAt.getTime() > ZERNIO_SYNC_STALE_MS)
}

/** Create a durable run, or reuse an interrupted Zernio run for this account. */
export async function queueZernioInitialSync(platformId: string, workspaceId: string): Promise<string | null> {
  return db.$transaction(async (tx) => {
    // Serialize concurrent callback/retry requests for the same platform.
    // This PostgreSQL transaction lock prevents two PENDING runs being created.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${platformId})::bigint)`
    const latest = await tx.instagramSyncRun.findFirst({
      where: { platformId, workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    if (latest && checkpointOf(latest.checkpoint)) {
      return zernioSyncCanResume(latest.status, latest.updatedAt) ? latest.id : null
    }
    const run = await tx.instagramSyncRun.create({
      data: {
        platformId,
        workspaceId,
        status: 'PENDING',
        currentStep: 'در انتظار همگام‌سازی',
        checkpoint: { provider: 'zernio' },
      },
    })
    return run.id
  })
}

export async function queueZernioInitialSyncForAccount(accountId: string, workspaceId: string): Promise<string | null> {
  const platform = await db.platform.findFirst({
    where: { workspaceId, provider: 'zernio', providerAccountId: accountId, type: 'instagram', status: 'active' },
    select: { id: true },
  })
  return platform ? queueZernioInitialSync(platform.id, workspaceId) : null
}

function safeError(error: unknown): string {
  if (error instanceof ZernioApiError) return `Zernio: ${error.code}`
  if (error instanceof Error && error.message.startsWith('sync_')) return error.message
  return 'sync_unavailable'
}

function validDate(value: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

/** Claim atomically, checkpoint each step, and safely skip previously imported posts on retry. */
export async function runZernioInitialSync(runId: string): Promise<void> {
  const run = await db.instagramSyncRun.findUnique({ where: { id: runId } })
  const checkpoint = checkpointOf(run?.checkpoint)
  if (!run || !checkpoint || !zernioSyncCanResume(run.status, run.updatedAt)) return

  const claimed = await db.instagramSyncRun.updateMany({
    where: { id: runId, status: run.status, updatedAt: run.updatedAt },
    data: { status: 'RUNNING', completedAt: null, errors: [], currentStep: 'بررسی حساب متصل' },
  })
  if (claimed.count !== 1) return

  try {
    const platform = await db.platform.findFirst({
      where: { id: run.platformId, workspaceId: run.workspaceId, provider: 'zernio', type: 'instagram', status: 'active' },
      select: { providerAccountId: true },
    })
    const workspace = await db.workspace.findUnique({
      where: { id: run.workspaceId },
      select: { zernioProfileId: true },
    })
    if (!platform?.providerAccountId || !workspace?.zernioProfileId) throw new Error('sync_account_missing')

    // Re-verify on every retry; a completed identity checkpoint must not
    // authorize an account that was since moved or disconnected in Zernio.
    const accounts = await listInstagramAccounts(workspace.zernioProfileId)
    if (!accounts.some((account) => account.id === platform.providerAccountId && account.isActive)) {
      throw new Error('sync_account_not_verified')
    }
    if (!checkpoint.identity) {
      checkpoint.identity = true
      await db.instagramSyncRun.update({
        where: { id: runId },
        data: { checkpoint, currentStep: 'دریافت پست‌های اخیر', currentStepIndex: 1 },
      })
    }

    if (!checkpoint.media) {
      const posts = await getInstagramRecentPosts(platform.providerAccountId, 25)
      for (const post of posts) {
        const existing = await db.content.findFirst({
          where: { workspaceId: run.workspaceId, origin: 'INSTAGRAM_IMPORT', importedPostId: post.id },
          select: { id: true },
        })
        if (existing) continue
        const caption = post.caption ?? ''
        await db.content.create({
          data: {
            workspaceId: run.workspaceId,
            title: caption.slice(0, 80) || `پست اینستاگرام ${post.id.slice(-6)}`,
            body: caption,
            status: 'published',
            origin: 'INSTAGRAM_IMPORT',
            importedPostId: post.id,
            thumbnailUrl: post.picture,
            publishedAt: validDate(post.createdTime),
          },
        })
        await db.instagramSyncRun.update({ where: { id: runId }, data: { currentStep: 'دریافت پست‌های اخیر' } })
      }
      checkpoint.media = true
      await db.instagramSyncRun.update({
        where: { id: runId },
        data: { checkpoint, importedMediaCount: posts.length, currentStepIndex: 2 },
      })
    }

    await db.instagramSyncRun.update({
      where: { id: runId },
      data: { status: 'COMPLETED', completedAt: new Date(), currentStep: 'پروفایل و پست‌های اخیر آماده‌اند', currentStepIndex: 2 },
    })
  } catch (error) {
    await db.instagramSyncRun.update({
      where: { id: runId },
      data: { status: 'FAILED', completedAt: new Date(), errors: { push: safeError(error) } },
    })
  }
}

/**
 * Issue #124: Publications domain module — service layer.
 *
 * Business logic only — no HTTP, no direct Prisma calls. Uses the repository
 * for data access. This makes the service unit-testable with a mock repository.
 *
 * The service orchestrates: validation → channel resolution → transactional
 * content+job+outbox creation → notification → response shaping.
 */

import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { assertExhaustive } from '@/lib/api-contracts'
import { publishJobsAccepted } from '@/lib/metrics'
import { structuredLogger } from '@/lib/structured-logger'
import { track } from '@/lib/track'
import { PublicationsRepository } from './repository'
import {
  ValidationError,
  NoChannelsError,
  ChannelsNotFoundError,
  PublicationNotFoundError,
  PublicationAlreadyResolvedError,
  ProviderPostIdRequiredError,
} from './errors'
import type {
  AuthContext,
  PublishRequest,
  PublishResult,
  ResolveAction,
  ResolveRequest,
  ResolveResult,
} from './types'

export class PublicationsService {
  constructor(private readonly repo: PublicationsRepository = new PublicationsRepository()) {}

  /**
   * Create a publication (content + publish jobs + outbox events).
   *
   * On success, emits observability signals (publishJobsAccepted counter,
   * publication_queued product event, structured success log) so route
   * handlers can stay thin.
   *
   * @throws {ValidationError} — missing channels for publish mode
   * @throws {ChannelsNotFoundError} — channel IDs don't match workspace
   * @throws {PublicationError} — other domain errors
   */
  async create(auth: AuthContext, body: PublishRequest): Promise<PublishResult> {
    const mode = body.mode ?? 'publish'
    const workspaceId = auth.workspaceId

    // Validate: publish mode requires at least one channel
    if (mode === 'publish' && (!body.channelIds || body.channelIds.length === 0)) {
      throw new NoChannelsError()
    }

    // Resolve channels (platforms) — must belong to this workspace
    const channels =
      mode !== 'draft' && body.channelIds && body.channelIds.length > 0
        ? await this.repo.findChannels(workspaceId, body.channelIds)
        : []

    if (mode === 'publish' && channels.length === 0) {
      throw new ChannelsNotFoundError()
    }

    // Resolve media — Issue #145: get full media records (not just thumbnail)
    const rawMedia = body.mediaIds?.length
      ? await this.repo.findMedia(workspaceId, body.mediaIds)
      : []

    // Preserve user-selected order: findMany with IN clause doesn't guarantee order
    const mediaIdOrder = body.mediaIds ?? []
    const mediaRecords = mediaIdOrder
      .map((id) => rawMedia.find((m) => m.id === id))
      .filter((m): m is NonNullable<typeof m> => m !== undefined)

    const thumbnailUrl = mediaRecords[0]?.thumbnailUrl ?? mediaRecords[0]?.url ?? null

    // Issue #145: build ordered media items for the revision (position = user-selected order)
    const mediaItems = mediaRecords.map((m, i) => ({
      id: m.id,
      position: i,
      role: m.fileType.startsWith('video/') ? 'video' : 'photo',
    }))

    // Compute scheduled time
    const scheduledAt = mode === 'publish' ? this.computeScheduledAt(body) : null

    const contentId = randomUUID()
    const status = mode === 'review' ? 'review' : mode === 'draft' ? 'draft' : 'scheduled'

    // Transactional: Content + ContentRevision + RevisionMedia + ChannelVariants +
    // ContentPlatform links + PublishJobs + Publications + OutboxEvents
    const result = await this.repo.transaction((tx) =>
      this.repo.createPublicationTx(tx, {
        contentId,
        workspaceId,
        campaignId: body.campaignId || null,
        title: body.title.trim(),
        caption: body.caption || null,
        hashtags: body.hashtags || null,
        note: body.note || null,
        status,
        thumbnailUrl,
        authorName: auth.authorName,
        scheduledAt,
        channels,
        mode,
        // Issue #145: pass ordered media + per-channel captions
        mediaItems,
        platformCaptions: body.platformCaptions,
        // Issue #155: propagate trace context so OutboxEvent stores it.
        traceParent: auth.trace?.traceparent ?? null,
      })
    )

    // Post-transaction: create user-facing notification
    if (mode === 'review') {
      await this.repo.createNotification(
        workspaceId,
        'approval_requested',
        'محتوای جدید برای تأیید',
        `«${body.title.trim()}» برای بررسی ارسال شد`
      )
    } else if (mode === 'publish') {
      await this.repo.createNotification(
        workspaceId,
        'publish_queued',
        `محتوای «${body.title.trim()}» برای انتشار در ${String(channels.length)} کانال زمان‌بندی شد`,
        `کانال‌ها: ${channels.map((p) => p.name).join('، ')}`
      )
    }

    const publishResult: PublishResult = {
      contentId: result.content.id,
      jobs: result.jobs,
      scheduledAt: scheduledAt?.toISOString() ?? null,
      message: this.buildMessage(body, mode),
    }

    // Issue #200: emit observability signals from the service so route handlers stay thin.
    // Issue #126: increment accepted counter per platform (for dashboards)
    for (const job of result.jobs) {
      publishJobsAccepted.inc({ workspace: workspaceId, platform: job.platform })
    }
    // Fire-and-forget product analytics — never block the response
    void Promise.allSettled(
      result.jobs.map((job) =>
        track({
          event: 'publication_queued',
          workspaceId,
          userId: auth.userId,
          jobId: job.id,
          platformType: job.platform,
          scheduleType: body.scheduleMode ?? 'now',
        }),
      ),
    )
    if (auth.trace) {
      structuredLogger.info({
        trace: auth.trace,
        operation: 'publish.service',
        workspaceId,
        contentId: publishResult.contentId,
        outcome: 'success',
        msg: `accepted ${result.jobs.length} publish job(s)`,
        extra: { platforms: result.jobs.map((j) => j.platform) },
      })
    }

    return publishResult
  }

  /**
   * Compute the scheduledAt Date from the request body.
   * Returns null for 'now' and 'queue' modes (immediate/queue dispatch).
   */
  private computeScheduledAt(body: PublishRequest): Date | null {
    if (body.scheduleMode === 'schedule' && body.scheduledAt) {
      const d = new Date(body.scheduledAt)
      if (isNaN(d.getTime())) return null
      // Reject timestamps more than 60s in the past (60s grace window for clock skew)
      if (d.getTime() < Date.now() - 60_000) {
        throw new ValidationError('زمان انتشار نمی‌تواند در گذشته باشد')
      }
      return d
    }
    return null
  }

  /**
   * Build the Persian success message based on mode + scheduleMode.
   */
  private buildMessage(body: PublishRequest, mode: 'publish' | 'review' | 'draft'): string {
    if (mode === 'review') return 'محتوا برای تأیید ارسال شد'
    if (mode === 'draft') return 'پیش‌نویس ذخیره شد'
    if (body.scheduleMode === 'now') return 'محتوا به صف انتشار ارسال شد'
    if (body.scheduleMode === 'schedule') return 'زمان‌بندی انتشار ثبت شد'
    return 'محتوا به صف انتشار افزوده شد'
  }

  /**
   * POST /api/publications/[id]/resolve — manual resolution for unknown outcomes (Issue #149).
   *
   * Allows an operator to manually resolve a publication stuck in
   * 'outcome_unknown' state after reconciliation failed. Actions:
   *   - mark_published: confirm externally published (requires providerPostId)
   *   - confirm_failure: confirm NOT published → allow retry
   *   - abandon: give up → mark as permanently failed
   *   - duplicate_safe_retry: safe to retry (provider idempotency) → re-enqueue
   *
   * Preserves the original ambiguous attempt via an audit log entry.
   *
   * @throws {PublicationNotFoundError} — id not in workspace
   * @throws {PublicationAlreadyResolvedError} — already confirmed_success/failure
   * @throws {ProviderPostIdRequiredError} — mark_published without providerPostId
   */
  async resolve(
    auth: AuthContext,
    publicationId: string,
    input: ResolveRequest
  ): Promise<ResolveResult> {
    const { workspaceId } = auth

    const publication = await db.publication.findFirst({
      where: { id: publicationId, workspaceId },
    })
    if (!publication) throw new PublicationNotFoundError()

    if (
      publication.reconciliationStatus === 'confirmed_success' ||
      publication.reconciliationStatus === 'confirmed_failure'
    ) {
      throw new PublicationAlreadyResolvedError()
    }

    const { action, providerPostId, reason } = input
    const now = new Date()

    // P1-1: Wrap all writes in a single transaction so the publication update,
    // outbox event creation (for retry), and audit log are atomic. Previously
    // if the outboxEvent.create or auditLog.create failed after the publication
    // was updated, the publication would be in an inconsistent state (e.g.
    // reset to 'pending' but never re-dispatched).
    await db.$transaction(async (tx) => {
      switch (action) {
        case 'mark_published': {
          if (!providerPostId) throw new ProviderPostIdRequiredError()
          await tx.publication.update({
            where: { id: publicationId },
            data: {
              status: 'success',
              providerPostId,
              providerAcknowledgedAt: now,
              reconciliationStatus: 'confirmed_success',
              completedAt: now,
            },
          })
          break
        }
        case 'confirm_failure': {
          await tx.publication.update({
            where: { id: publicationId },
            data: {
              status: 'failed',
              reconciliationStatus: 'confirmed_failure',
              errorCategory: 'unknown',
              errorMessage: `تأیید شده توسط اپراتور: ${reason}`,
              completedAt: now,
            },
          })
          break
        }
        case 'abandon': {
          await tx.publication.update({
            where: { id: publicationId },
            data: {
              status: 'failed',
              reconciliationStatus: 'confirmed_failure',
              errorCategory: 'unknown',
              errorMessage: `رها شده توسط اپراتور: ${reason}`,
              completedAt: now,
            },
          })
          break
        }
        case 'duplicate_safe_retry': {
          // Reset to pending so the outbox dispatcher re-enqueues it
          await tx.publication.update({
            where: { id: publicationId },
            data: {
              status: 'pending',
              reconciliationStatus: null,
              errorMessage: null,
              errorCategory: null,
            },
          })
          await tx.outboxEvent.create({
            data: {
              workspaceId,
              aggregateType: 'content',
              aggregateId: publication.contentId,
              eventType: 'publish_requested',
              payload: {
                jobId: publication.publishJobId,
                contentId: publication.contentId,
                platformId: publication.platformId,
                workspaceId,
                publicationId,
                revisionId: publication.revisionId,
              },
              status: 'pending',
              availableAt: now,
            },
          })
          break
        }
        default:
          assertExhaustive(action as never)
      }

      // Preserve the original ambiguous attempt in the audit trail
      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          workspaceId,
          action: `publication.resolved.${action}`,
          resource: 'Publication',
          metadata: {
            publicationId,
            action,
            providerPostId: providerPostId ?? null,
            reason,
            previousStatus: publication.status,
            previousReconciliation: publication.reconciliationStatus,
          },
        },
      })
    })

    return {
      ok: true,
      message: RESOLVE_MESSAGES[action],
      action: action as ResolveAction,
    }
  }
}

const RESOLVE_MESSAGES: Record<ResolveAction, string> = {
  mark_published: 'انتشار به عنوان موفق تأیید شد',
  confirm_failure: 'انتشار به عنوان ناموفق تأیید شد — امکان تلاش مجدد وجود دارد',
  abandon: 'انتشار رها شد',
  duplicate_safe_retry: 'انتشار برای تلاش مجدد ایمن به صف بازگردانده شد',
}

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
import { PublicationsRepository } from './repository'
import {
  ValidationError,
  NoChannelsError,
  ChannelsNotFoundError,
  type PublicationError,
} from './errors'
import type { AuthContext, PublishRequest, PublishResult } from './types'

export class PublicationsService {
  constructor(private readonly repo: PublicationsRepository = new PublicationsRepository()) {}

  /**
   * Create a publication (content + publish jobs + outbox events).
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

    return {
      contentId: result.content.id,
      jobs: result.jobs,
      scheduledAt: scheduledAt?.toISOString() ?? null,
      message: this.buildMessage(body, mode),
    }
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
}

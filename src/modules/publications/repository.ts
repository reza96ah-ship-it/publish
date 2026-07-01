/**
 * Issue #124: Publications domain module — repository layer.
 *
 * Data access only — no business logic. Wraps Prisma calls so the service
 * layer can be unit-tested with a mock repository (no DB needed).
 *
 * The repository accepts a transaction client (tx) so the service can run
 * Content + PublishJobs + OutboxEvents in a single atomic transaction.
 */

import { db } from '@/lib/db'

// Type alias for the Prisma transaction client. Prisma's $transaction callback
// receives an Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>.
// We use `typeof db.$transaction`'s parameter type to stay in sync with Prisma.
type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0]

export interface ContentRow {
  id: string
  workspaceId: string
  campaignId: string | null
  title: string
  body: string | null
  hashtags: string | null
  internalNote: string | null
  status: string
  thumbnailUrl: string | null
  authorName: string | null
  scheduledAt: Date | null
}

export interface JobRow {
  id: string
  platform: string
  idempotencyKey: string
}

export interface ChannelRow {
  id: string
  type: string
  name: string
}

export class PublicationsRepository {
  /**
   * Find channels (platforms) by IDs within a workspace.
   */
  async findChannels(workspaceId: string, channelIds: string[]): Promise<ChannelRow[]> {
    if (channelIds.length === 0) return []
    const platforms = await db.platform.findMany({
      where: { workspaceId, id: { in: channelIds } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, type: true, name: true },
    })
    return platforms
  }

  /**
   * Find media by IDs within a workspace. Returns full media records (not just thumbnail).
   * Issue #145: we need the real media type, URL, and thumbnail — not just one thumbnail URL.
   */
  async findMedia(
    workspaceId: string,
    mediaIds: string[]
  ): Promise<{ id: string; url: string; thumbnailUrl: string | null; fileType: string }[]> {
    if (mediaIds.length === 0) return []
    const media = await db.media.findMany({
      where: { id: { in: mediaIds }, workspaceId },
      select: { id: true, url: true, thumbnailUrl: true, fileType: true },
    })
    return media
  }

  /**
   * Legacy: find just the thumbnail URL (kept for backward compat).
   */
  async findMediaThumbnail(
    workspaceId: string,
    mediaIds: string[]
  ): Promise<string | null> {
    const media = await this.findMedia(workspaceId, mediaIds)
    return media[0]?.thumbnailUrl ?? media[0]?.url ?? null
  }

  /**
   * Create content + content-platform links + publish jobs + outbox events
   * in a single transaction. Returns the created content + jobs.
   *
   * This is the core transactional outbox pattern (MISS-01): if Redis/BullMQ
   * is down, the outbox events survive in Postgres and are delivered later.
   */
  async createPublicationTx(
    tx: TxClient,
    params: {
      contentId: string
      workspaceId: string
      campaignId: string | null
      title: string
      caption: string | null
      hashtags: string | null
      note: string | null
      status: string
      thumbnailUrl: string | null
      authorName: string
      scheduledAt: Date | null
      channels: ChannelRow[]
      mode: 'publish' | 'review' | 'draft'
      // Issue #145: ordered media + per-channel captions
      mediaItems?: { id: string; position: number; role: string }[]
      platformCaptions?: Record<string, string> // channelId → override caption
      // Issue #155: W3C trace context to persist on each OutboxEvent so the
      // worker can continue the trace when processing the queued job.
      traceParent?: string | null
    }
  ): Promise<{ content: ContentRow; jobs: JobRow[] }> {
    const content = await tx.content.create({
      data: {
        id: params.contentId,
        workspaceId: params.workspaceId,
        campaignId: params.campaignId,
        title: params.title,
        body: params.caption,
        hashtags: params.hashtags,
        internalNote: params.note,
        status: params.status,
        thumbnailUrl: params.thumbnailUrl,
        authorName: params.authorName,
        scheduledAt: params.scheduledAt,
      },
    })

    // Issue #145: create an immutable ContentRevision (snapshot of the content at publish time)
    const revisionId = crypto.randomUUID()
    const revision = await (tx as any).contentRevision.create({
      data: {
        id: revisionId,
        contentId: content.id,
        workspaceId: params.workspaceId,
        title: params.title,
        body: params.caption,
        hashtags: params.hashtags,
        internalNote: params.note,
        authorName: params.authorName,
        version: 1,
      },
    })

    // Issue #145: create ordered RevisionMedia links (replaces thumbnailUrl-as-media)
    if (params.mediaItems && params.mediaItems.length > 0) {
      for (const m of params.mediaItems) {
        await (tx as any).revisionMedia.create({
          data: {
            revisionId: revision.id,
            mediaId: m.id,
            position: m.position,
            role: m.role,
          },
        })
      }
    }

    // Link content to each channel
    for (const ch of params.channels) {
      await tx.contentPlatform.create({
        data: { contentId: content.id, platformId: ch.id },
      })

      // Issue #145: create ChannelVariant for per-channel caption overrides
      const overrideCaption = params.platformCaptions?.[ch.id]
      if (overrideCaption !== undefined) {
        await (tx as any).channelVariant.create({
          data: {
            revisionId: revision.id,
            platformId: ch.id,
            caption: overrideCaption,
          },
        })
      }
    }

    const jobs: JobRow[] = []
    if (params.mode === 'publish') {
      for (const ch of params.channels) {
        const jobId = crypto.randomUUID()
        const idempotencyKey = crypto.randomUUID()
        const job = await tx.publishJob.create({
          data: {
            id: jobId,
            workspaceId: params.workspaceId,
            contentId: content.id,
            platformId: ch.id,
            campaignId: params.campaignId,
            status: 'pending',
            progress: 0,
            processLabel: 'در انتظار',
            idempotencyKey,
            scheduledAt: params.scheduledAt,
            thumbnailUrl: params.thumbnailUrl,
          },
        })
        jobs.push({ id: job.id, platform: ch.type, idempotencyKey: job.idempotencyKey })

        // Issue #145: create a first-class Publication record for this destination
        const publicationId = crypto.randomUUID()
        const { createHash } = await import('crypto')
        const requestFingerprint = createHash('sha256')
          .update(`${ch.id}:${content.id}:${revision.id}`)
          .digest('hex')
        await (tx as any).publication.create({
          data: {
            id: publicationId,
            workspaceId: params.workspaceId,
            contentId: content.id,
            revisionId: revision.id,
            platformId: ch.id,
            publishJobId: job.id,
            campaignId: params.campaignId,
            status: 'pending',
            scheduledAt: params.scheduledAt,
            requestFingerprint,
          },
        })

        // MISS-01: write OutboxEvent in the same transaction
        await tx.outboxEvent.create({
          data: {
            workspaceId: params.workspaceId,
            aggregateType: 'content',
            aggregateId: content.id,
            eventType: 'publish_requested',
            payload: {
              jobId: job.id,
              contentId: content.id,
              platformId: ch.id,
              workspaceId: params.workspaceId,
              scheduledAt: params.scheduledAt?.toISOString() ?? null,
              idempotencyKey: job.idempotencyKey,
              // Issue #145: include publication + revision IDs for the worker
              publicationId,
              revisionId: revision.id,
              // Issue #155: include traceparent in payload too (belt+suspenders
              // — the dedicated traceParent column is the canonical place).
              traceParent: params.traceParent ?? null,
            },
            // Issue #155: persist W3C trace context for the worker to continue.
            traceParent: params.traceParent ?? null,
            availableAt: params.scheduledAt ?? new Date(),
          },
        })
      }
    }

    return {
      content: {
        id: content.id,
        workspaceId: content.workspaceId,
        campaignId: content.campaignId,
        title: content.title,
        body: content.body,
        hashtags: content.hashtags,
        internalNote: content.internalNote,
        status: content.status,
        thumbnailUrl: content.thumbnailUrl,
        authorName: content.authorName,
        scheduledAt: content.scheduledAt,
      },
      jobs,
    }
  }

  /**
   * Create a notification for the workspace (post-transaction).
   */
  async createNotification(
    workspaceId: string,
    type: string,
    title: string,
    body?: string
  ): Promise<void> {
    await db.notification.create({
      data: { workspaceId, type, title, body, isRead: false },
    })
  }

  /**
   * Run a function inside a Prisma transaction.
   */
  async transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return db.$transaction(fn)
  }
}

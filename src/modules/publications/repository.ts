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
   * Find media by IDs within a workspace. Returns the first thumbnail/url.
   */
  async findMediaThumbnail(
    workspaceId: string,
    mediaIds: string[]
  ): Promise<string | null> {
    if (mediaIds.length === 0) return null
    const media = await db.media.findMany({
      where: { id: { in: mediaIds }, workspaceId },
      select: { thumbnailUrl: true, url: true },
    })
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

    // Link content to each channel
    for (const ch of params.channels) {
      await tx.contentPlatform.create({
        data: { contentId: content.id, platformId: ch.id },
      })
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
            },
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

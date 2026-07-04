import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublicationsService } from '../../../src/modules/publications/service'
import {
  PublicationsRepository,
  type ChannelRow,
} from '../../../src/modules/publications/repository'
import {
  NoChannelsError,
  ChannelsNotFoundError,
} from '../../../src/modules/publications/errors'
import type { AuthContext, PublishRequest } from '../../../src/modules/publications/types'

/**
 * Issue #124 + #125: Service-layer unit tests.
 *
 * The service layer is unit-testable WITHOUT a database because it depends
 * on the repository interface (not Prisma directly). We mock the repository
 * to verify business logic in isolation.
 */

function makeMockRepo(): PublicationsRepository {
  return {
    findChannels: vi.fn(async (_ws: string, _ids: string[]): Promise<ChannelRow[]> => []),
    findMediaThumbnail: vi.fn(async (_ws: string, _ids: string[]): Promise<string | null> => null),
    createPublicationTx: vi.fn(async (_tx: any, params: any) => ({
      content: {
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
      jobs: params.mode === 'publish'
        ? params.channels.map((ch: ChannelRow) => ({
            id: `job-${ch.id}`,
            platform: ch.type,
            idempotencyKey: `idem-${ch.id}`,
          }))
        : [],
    })),
    createNotification: vi.fn(async () => {}),
    transaction: vi.fn(async (fn) => fn({} as any)),
  } as unknown as PublicationsRepository
}

const auth: AuthContext = {
  workspaceId: 'ws-1',
  userId: 'user-1',
  authorName: 'کاربر تست',
  role: 'admin',
}

describe('Issue #124/#125 — PublicationsService (service-layer unit tests, no DB)', () => {
  let service: PublicationsService
  let repo: PublicationsRepository

  beforeEach(() => {
    repo = makeMockRepo()
    service = new PublicationsService(repo)
  })

  describe('publish mode', () => {
    it('creates content + jobs for each channel', async () => {
      vi.mocked(repo.findChannels).mockResolvedValue([
        { id: 'ch-1', type: 'telegram', name: 'کانال تلگرام' },
        { id: 'ch-2', type: 'instagram', name: 'پیج اینستاگرام' },
      ])

      const body: PublishRequest = {
        title: 'پست تستی',
        caption: 'متن کپشن',
        scheduleMode: 'now',
        mode: 'publish',
        channelIds: ['ch-1', 'ch-2'],
      }

      const result = await service.create(auth, body)

      expect(result.contentId).toBeTruthy()
      expect(result.jobs).toHaveLength(2)
      expect(result.jobs[0]?.platform).toBe('telegram')
      expect(result.jobs[1]?.platform).toBe('instagram')
      expect(result.message).toBe('محتوا به صف انتشار ارسال شد')
    })

    it('throws NoChannelsError when channelIds is empty', async () => {
      const body: PublishRequest = {
        title: 'پست تستی',
        scheduleMode: 'now',
        mode: 'publish',
        channelIds: [],
      }

      await expect(service.create(auth, body)).rejects.toThrow(NoChannelsError)
    })

    it('throws NoChannelsError when channelIds is undefined', async () => {
      const body: PublishRequest = {
        title: 'پست تستی',
        scheduleMode: 'now',
        mode: 'publish',
      }

      await expect(service.create(auth, body)).rejects.toThrow(NoChannelsError)
    })

    it('throws ChannelsNotFoundError when no channels match the workspace', async () => {
      vi.mocked(repo.findChannels).mockResolvedValue([])

      const body: PublishRequest = {
        title: 'پست تستی',
        scheduleMode: 'now',
        mode: 'publish',
        channelIds: ['nonexistent-id'],
      }

      await expect(service.create(auth, body)).rejects.toThrow(ChannelsNotFoundError)
    })

    it('creates notification with publish_queued type', async () => {
      vi.mocked(repo.findChannels).mockResolvedValue([
        { id: 'ch-1', type: 'telegram', name: 'کانال تلگرام' },
      ])

      await service.create(auth, {
        title: 'پست تستی',
        scheduleMode: 'now',
        mode: 'publish',
        channelIds: ['ch-1'],
      })

      expect(repo.createNotification).toHaveBeenCalledWith(
        'ws-1',
        'publish_queued',
        expect.stringContaining('پست تستی'),
        expect.any(String)
      )
    })
  })

  describe('review mode', () => {
    it('creates content with status=review and no publish jobs', async () => {
      const body: PublishRequest = {
        title: 'محتوای نیازمند تأیید',
        scheduleMode: 'now',
        mode: 'review',
        channelIds: ['ch-1'],
      }

      const result = await service.create(auth, body)

      expect(result.jobs).toHaveLength(0)
      expect(result.message).toBe('محتوا برای تأیید ارسال شد')
    })

    it('creates approval_requested notification', async () => {
      await service.create(auth, {
        title: 'محتوای نیازمند تأیید',
        scheduleMode: 'now',
        mode: 'review',
      })

      expect(repo.createNotification).toHaveBeenCalledWith(
        'ws-1',
        'approval_requested',
        'محتوای جدید برای تأیید',
        expect.stringContaining('محتوای نیازمند تأیید')
      )
    })
  })

  describe('draft mode', () => {
    it('creates content with status=draft and no jobs', async () => {
      const result = await service.create(auth, {
        title: 'پیش‌نویس',
        scheduleMode: 'now',
        mode: 'draft',
      })

      expect(result.jobs).toHaveLength(0)
      expect(result.message).toBe('پیش‌نویس ذخیره شد')
    })

    it('does not create a notification for drafts', async () => {
      await service.create(auth, {
        title: 'پیش‌نویس',
        scheduleMode: 'now',
        mode: 'draft',
      })

      expect(repo.createNotification).not.toHaveBeenCalled()
    })
  })

  describe('scheduling', () => {
    it('computes scheduledAt from scheduleMode=schedule + scheduledAt', async () => {
      vi.mocked(repo.findChannels).mockResolvedValue([
        { id: 'ch-1', type: 'telegram', name: 'کانال' },
      ])

      const futureDate = new Date(Date.now() + 86400000).toISOString()
      const result = await service.create(auth, {
        title: 'زمان‌بندی شده',
        scheduleMode: 'schedule',
        scheduledAt: futureDate,
        mode: 'publish',
        channelIds: ['ch-1'],
      })

      expect(result.scheduledAt).toBe(futureDate)
      expect(result.message).toBe('زمان‌بندی انتشار ثبت شد')
    })

    it('returns null scheduledAt for scheduleMode=now', async () => {
      vi.mocked(repo.findChannels).mockResolvedValue([
        { id: 'ch-1', type: 'telegram', name: 'کانال' },
      ])

      const result = await service.create(auth, {
        title: 'فوری',
        scheduleMode: 'now',
        mode: 'publish',
        channelIds: ['ch-1'],
      })

      expect(result.scheduledAt).toBeNull()
    })

    it('returns null scheduledAt for invalid date string', async () => {
      vi.mocked(repo.findChannels).mockResolvedValue([
        { id: 'ch-1', type: 'telegram', name: 'کانال' },
      ])

      const result = await service.create(auth, {
        title: 'تاریخ نامعتبر',
        scheduleMode: 'schedule',
        scheduledAt: 'not-a-date',
        mode: 'publish',
        channelIds: ['ch-1'],
      })

      expect(result.scheduledAt).toBeNull()
    })

    it('returns queue message for scheduleMode=queue', async () => {
      vi.mocked(repo.findChannels).mockResolvedValue([
        { id: 'ch-1', type: 'telegram', name: 'کانال' },
      ])

      const result = await service.create(auth, {
        title: 'صف',
        scheduleMode: 'queue',
        mode: 'publish',
        channelIds: ['ch-1'],
      })

      expect(result.message).toBe('محتوا به صف انتشار افزوده شد')
    })
  })

  describe('transactional outbox', () => {
    it('wraps createPublicationTx in repo.transaction', async () => {
      vi.mocked(repo.findChannels).mockResolvedValue([
        { id: 'ch-1', type: 'telegram', name: 'کانال' },
      ])

      await service.create(auth, {
        title: 'تراکنش',
        scheduleMode: 'now',
        mode: 'publish',
        channelIds: ['ch-1'],
      })

      expect(repo.transaction).toHaveBeenCalled()
      expect(repo.createPublicationTx).toHaveBeenCalled()
    })
  })
})

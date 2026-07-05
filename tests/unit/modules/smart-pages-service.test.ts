import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock db BEFORE importing the service
const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    smartPage: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    smartPageClick: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    workspace: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db', () => ({ db: dbMock }))

import { smartPagesService } from '@/modules/smart-pages'

const AUTH = { workspaceId: 'ws_1', userId: 'user_1' }

const basePage = {
  id: 'page_1',
  workspaceId: 'ws_1',
  slug: 'my-links',
  title: 'لینک‌های من',
  description: 'صفحه هوشمند',
  avatarUrl: null,
  blocks: [],
  isPublished: false,
  views: 0,
  clicks: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('SmartPagesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listSmartPages', () => {
    it('returns paginated list with nextCursor', async () => {
      // Return limit+1 items to trigger "hasMore"
      const items = Array.from({ length: 6 }, (_, i) => ({ ...basePage, id: `page_${i}`, slug: `slug-${i}` }))
      dbMock.smartPage.findMany.mockResolvedValue(items)

      const result = await smartPagesService.listSmartPages(AUTH, { limit: 5 })

      expect(result.data).toHaveLength(5)
      expect(result.nextCursor).toBe('page_4')
      expect(dbMock.smartPage.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { workspaceId: 'ws_1' },
        take: 6, // limit+1
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }))
    })

    it('returns null nextCursor when no more items', async () => {
      const items = Array.from({ length: 3 }, (_, i) => ({ ...basePage, id: `page_${i}` }))
      dbMock.smartPage.findMany.mockResolvedValue(items)

      const result = await smartPagesService.listSmartPages(AUTH, { limit: 5 })

      expect(result.data).toHaveLength(3)
      expect(result.nextCursor).toBeNull()
    })
  })

  describe('createSmartPage', () => {
    it('creates a smart page with default blocks', async () => {
      dbMock.smartPage.create.mockResolvedValue({ ...basePage, slug: 'test-page', title: 'تست' })

      const result = await smartPagesService.createSmartPage(AUTH, {
        slug: 'test-page',
        title: 'تست',
      })

      expect(result.slug).toBe('test-page')
      expect(dbMock.smartPage.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws_1',
          slug: 'test-page',
          title: 'تست',
          blocks: [],
          isPublished: false,
        }),
      }))
    })

    it('throws SlugConflictError on P2002', async () => {
      const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      dbMock.smartPage.create.mockRejectedValue(p2002)

      await expect(
        smartPagesService.createSmartPage(AUTH, { slug: 'duplicate', title: 'تست' })
      ).rejects.toThrow('این نامک قبلاً استفاده شده است')
    })
  })

  describe('updateSmartPage', () => {
    it('updates page fields', async () => {
      dbMock.smartPage.findFirst.mockResolvedValue({ ...basePage, id: 'page_1' })
      dbMock.smartPage.update.mockResolvedValue({ ...basePage, id: 'page_1', title: 'عنوان جدید' })

      const result = await smartPagesService.updateSmartPage(AUTH, 'page_1', { title: 'عنوان جدید' })

      expect(result.title).toBe('عنوان جدید')
      expect(dbMock.smartPage.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'page_1' },
        data: { title: 'عنوان جدید' },
      }))
    })

    it('throws SmartPageNotFoundError when page does not exist', async () => {
      dbMock.smartPage.findFirst.mockResolvedValue(null)

      await expect(
        smartPagesService.updateSmartPage(AUTH, 'nonexistent', { title: 'test' })
      ).rejects.toThrow('صفحه یافت نشد')
    })
  })

  describe('deleteSmartPage', () => {
    it('deletes an existing page', async () => {
      dbMock.smartPage.findFirst.mockResolvedValue({ ...basePage, id: 'page_1' })
      dbMock.smartPage.delete.mockResolvedValue({})

      await smartPagesService.deleteSmartPage(AUTH, 'page_1')

      expect(dbMock.smartPage.delete).toHaveBeenCalledWith({ where: { id: 'page_1' } })
    })

    it('throws SmartPageNotFoundError when page does not exist', async () => {
      dbMock.smartPage.findFirst.mockResolvedValue(null)

      await expect(smartPagesService.deleteSmartPage(AUTH, 'nonexistent'))
        .rejects.toThrow('صفحه یافت نشد')
    })
  })

  describe('findBySlug (public)', () => {
    it('returns page with workspace brand colors for published pages', async () => {
      const pageWithWs = {
        ...basePage,
        isPublished: true,
        brandPrimaryColor: '#0F766E',
        brandAccentColor: '#7c3aed',
        workspaceName: 'برند من',
      }
      dbMock.smartPage.findFirst.mockResolvedValue({
        ...basePage,
        isPublished: true,
        workspace: { name: 'برند من', brandPrimaryColor: '#0F766E', brandAccentColor: '#7c3aed' },
      })
      dbMock.smartPage.update.mockResolvedValue({})

      const result = await smartPagesService.findBySlug('my-links')

      expect(result.slug).toBe('my-links')
      expect(result.brandAccentColor).toBe('#7c3aed')
      expect(result.workspaceName).toBe('برند من')
      // Should increment views (fire-and-forget)
      expect(dbMock.smartPage.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { views: { increment: 1 } },
      }))
    })

    it('throws SmartPageNotFoundError for unknown slug', async () => {
      dbMock.smartPage.findFirst.mockResolvedValue(null)

      await expect(smartPagesService.findBySlug('unknown')).rejects.toThrow('صفحه یافت نشد')
    })
  })

  describe('recordClick (public)', () => {
    it('records a click and increments the click counter', async () => {
      dbMock.smartPage.findFirst.mockResolvedValue({
        ...basePage,
        id: 'page_1',
        isPublished: true,
        workspace: { name: 'برند', brandPrimaryColor: '#0F766E', brandAccentColor: '#7c3aed' },
      })
      dbMock.smartPageClick.create.mockResolvedValue({})
      dbMock.smartPage.update.mockResolvedValue({})

      await smartPagesService.recordClick('my-links', {
        blockId: 'block_1',
        blockType: 'link',
        label: 'وب‌سایت',
        url: 'https://example.com',
      })

      expect(dbMock.smartPageClick.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          smartPageId: 'page_1',
          blockId: 'block_1',
          blockType: 'link',
          label: 'وب‌سایت',
          url: 'https://example.com',
        }),
      }))
      expect(dbMock.smartPage.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { clicks: { increment: 1 } },
      }))
    })

    it('throws SmartPageNotFoundError for unknown slug', async () => {
      dbMock.smartPage.findFirst.mockResolvedValue(null)

      await expect(
        smartPagesService.recordClick('unknown', {
          blockId: 'b1',
          blockType: 'link',
          label: '',
          url: '',
        })
      ).rejects.toThrow('صفحه یافت نشد')
    })
  })
})

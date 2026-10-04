import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../setup'

const apiMock = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: apiMock }))

import { CommentDmRulesPanel } from '@/components/automation/comment-dm-rules'

describe('comment-to-DM run history in the existing rule list', () => {
  it('shows provider evidence and a warning for an ambiguous attempt', async () => {
    apiMock.get.mockImplementation(async (url: string) => {
      if (url.endsWith('/logs')) return { runs: [
        {
          id: 'log-1', commentId: 'comment-1',
          sentAt: '2026-10-04T12:00:00.000Z', status: 'sent',
          providerMessageId: 'message-1', publicReplyStatus: 'sent', errorCode: null,
        },
        {
          id: 'log-2', commentId: 'comment-2',
          sentAt: '2026-10-04T11:00:00.000Z', status: 'unknown',
          providerMessageId: null, publicReplyStatus: null, errorCode: 'missing_dm_receipt',
        },
      ] }
      return [{
        id: 'rule-1', platformId: 'platform-1', platformName: 'Instagram', publicationId: null,
        igPostId: null, keyword: 'قیمت', keywords: ['قیمت'], excludeKeywords: [],
        dmTemplate: 'سلام', buttonText: null, buttonUrl: null, publicReply: null,
        optOutKeyword: 'نه', freqCapHours: 24, status: 'active', isActive: true,
        createdAt: '2026-10-04T10:00:00.000Z',
      }]
    })

    renderWithProviders(<CommentDmRulesPanel
      platforms={[{ id: 'platform-1', name: 'Instagram', type: 'instagram' }]}
      readOnly
    />)
    fireEvent.click(await screen.findByRole('button', { name: 'گزارش اجرا' }))
    expect(await screen.findByText('DM receipt: message-1')).toBeInTheDocument()
    expect(screen.getByText('نتیجهٔ دایرکت نامشخص')).toBeInTheDocument()
    expect(screen.getByText('برای جلوگیری از دایرکت تکراری، نتیجه را در اینستاگرام بررسی کنید.')).toBeInTheDocument()
  })
})

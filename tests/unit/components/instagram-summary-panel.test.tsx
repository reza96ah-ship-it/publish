import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../setup'
import { InstagramSummaryPanel } from '../../../src/components/dashboard/instagram-summary-panel'
import { api } from '../../../src/lib/api'

vi.mock('../../../src/lib/api', () => ({ api: { get: vi.fn() } }))

const get = vi.mocked(api.get)

describe('InstagramSummaryPanel', () => {
  beforeEach(() => get.mockReset())

  it('shows the connected profile and its 30-day insights', async () => {
    get.mockImplementation(async (path) => {
      if (path === '/api/platforms/zernio/instagram/accounts') {
        return {
          accounts: [{
            id: '507f1f77bcf86cd799439011',
            username: 'couchlet',
            displayName: 'Couchlet',
            profileUrl: 'https://www.instagram.com/couchlet/',
            avatarUrl: '/api/platforms/zernio/instagram/accounts/507f1f77bcf86cd799439011/photo',
            followersCount: 34,
            isActive: true,
          }],
        }
      }
      return {
        insights: { reach: 8186, views: 9881, accountsEngaged: 242, totalInteractions: 530 },
        insightsStatus: 'available',
        recentPosts: [{ id: 'post-1', caption: 'Latest post', permalink: null, likeCount: 12, commentCount: 3 }],
        postsStatus: 'available',
      }
    })

    renderWithProviders(<InstagramSummaryPanel />)

    expect(await screen.findByText('@couchlet')).toBeInTheDocument()
    expect(screen.getByAltText('تصویر پروفایل couchlet')).toHaveAttribute('src', '/api/platforms/zernio/instagram/accounts/507f1f77bcf86cd799439011/photo')
    expect(await screen.findByText('۸٬۱۸۶')).toBeInTheDocument()
    expect(screen.getByText('Latest post')).toBeInTheDocument()
    expect(screen.getByText(/مستقل از فیلترهای داشبورد/)).toBeInTheDocument()
  })

  it('offers a connection path when no account is connected', async () => {
    get.mockResolvedValue({ accounts: [] })
    renderWithProviders(<InstagramSummaryPanel />)

    expect(await screen.findByText(/هنوز حساب حرفه‌ای اینستاگرام متصل نشده است/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /مدیریت حساب‌ها/ })).toHaveAttribute('href', '/channels')
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
  })
})

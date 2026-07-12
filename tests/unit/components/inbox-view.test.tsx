import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../setup'
import { InboxView } from '../../../src/components/views/inbox-view'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    getPaginated: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => ({ api: apiMock }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/inbox',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const thread = {
  id: 'thread-1',
  providerThreadId: 'provider-thread-1',
  providerUserId: 'provider-user-1',
  title: 'مخاطب گفتگو',
  platform: 'instagram',
  platformName: 'اینستاگرام اصلی',
  messageType: 'dm',
  status: 'new',
  assigneeId: null,
  assigneeName: null,
  assigneeAvatar: null,
  priority: 'urgent',
  tags: ['فروش'],
  lockedById: null,
  lockedByName: null,
  lockExpiresAt: null,
  unreadCount: 1,
  lastMessageAt: '2026-07-11T10:00:00.000Z',
  slaStartedAt: '2026-07-11T06:00:00.000Z',
  firstResponseAt: null,
  resolvedAt: null,
  createdAt: '2026-07-11T06:00:00.000Z',
  updatedAt: '2026-07-11T10:00:00.000Z',
  lastMessage: {
    id: 'thread-message-1',
    providerMessageId: 'provider-message-1',
    direction: 'inbound',
    messageType: 'dm',
    senderExternalId: 'provider-user-1',
    senderName: 'مخاطب گفتگو',
    body: 'برای خرید راهنمایی می‌خواهم',
    attachments: [],
    createdAt: '2026-07-11T10:00:00.000Z',
  },
}

const threadDetail = {
  ...thread,
  messages: [thread.lastMessage],
}

const legacyMessage = {
  id: 'legacy-1',
  senderName: 'مخاطب قدیمی',
  senderAvatar: null,
  message: 'پیام قدیمی',
  isRead: true,
  isReplied: false,
  reply: null,
  platform: 'instagram',
  platformName: 'اینستاگرام اصلی',
  messageType: 'comment',
  assigneeId: null,
  assigneeName: null,
  assigneeAvatar: null,
  createdAt: '2026-07-10T10:00:00.000Z',
  status: 'new',
  slaStartedAt: null,
}

function arrangeInbox() {
  apiMock.getPaginated.mockImplementation((path: string) => {
    if (path === '/api/inbox/threads') return Promise.resolve([thread])
    if (path === '/api/inbox') return Promise.resolve([legacyMessage])
    if (path === '/api/members') {
      return Promise.resolve([{ id: 'member-1', name: 'کارشناس', avatar: null, roleLabel: 'مدیر' }])
    }
    return Promise.resolve([])
  })
  apiMock.get.mockImplementation((path: string) => {
    if (path === '/api/inbox/threads/thread-1') return Promise.resolve(threadDetail)
    return Promise.resolve([])
  })
  apiMock.post.mockResolvedValue({ ok: true })
}

describe('Component: InboxView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    arrangeInbox()
  })

  it('renders thread and legacy conversations together', async () => {
    renderWithProviders(<InboxView />)

    expect(await screen.findByText('مخاطب گفتگو')).toBeInTheDocument()
    expect(screen.getByText('مخاطب قدیمی')).toBeInTheDocument()
    expect(screen.getByText('فوری')).toBeInTheDocument()
    expect(screen.getByText('ناخوانده')).toBeInTheDocument()
  })

  it('opens the thread workflow and routes read state through the thread API', async () => {
    renderWithProviders(<InboxView />)

    const row = await screen.findByRole('button', { name: /مخاطب گفتگو، ناخوانده/ })
    fireEvent.click(row)

    expect(await screen.findByRole('button', { name: 'واگذاری به من' })).toBeInTheDocument()
    expect(screen.getByLabelText('برچسب جدید')).toBeInTheDocument()
    expect(screen.getByText('فوری')).toBeInTheDocument()
    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/api/inbox/threads/thread-1/read', {})
    })
  })

  it('adds a tag through the thread tags API', async () => {
    renderWithProviders(<InboxView />)
    fireEvent.click(await screen.findByRole('button', { name: /مخاطب گفتگو، ناخوانده/ }))

    fireEvent.change(await screen.findByLabelText('برچسب جدید'), { target: { value: 'ویژه' } })
    fireEvent.click(screen.getByRole('button', { name: 'افزودن برچسب' }))

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/api/inbox/threads/thread-1/tags', {
        tags: ['فروش', 'ویژه'],
      })
    })
  })
})

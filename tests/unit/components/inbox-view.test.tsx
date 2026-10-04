import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../setup'
import { InboxView } from '../../../src/components/views/inbox-view'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    getPage: vi.fn(),
    getPaginated: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => ({ api: apiMock }))
vi.mock('@/hooks/use-inbox-stream', () => ({ useInboxStream: vi.fn() }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/inbox',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

function thread(id: string, title: string, body: string, unreadCount = 1) {
  const createdAt = id === 'thread-1' ? '2026-07-12T10:00:00.000Z' : '2026-07-12T09:00:00.000Z'
  return {
    id,
    providerThreadId: `provider-${id}`,
    providerUserId: `user-${id}`,
    title,
    platform: 'instagram',
    platformName: 'Instagram',
    messageType: 'comment',
    status: 'new',
    assigneeId: null,
    assigneeName: null,
    assigneeAvatar: null,
    priority: 'normal',
    tags: [],
    lockedById: null,
    lockedByName: null,
    lockExpiresAt: null,
    unreadCount,
    lastMessageAt: createdAt,
    lastInboundAt: createdAt,
    slaStartedAt: createdAt,
    firstResponseAt: null,
    resolvedAt: null,
    replyWindowExpiresAt: null,
    createdAt,
    updatedAt: createdAt,
    lastMessage: {
      id: `message-${id}`,
      providerMessageId: `provider-message-${id}`,
      direction: 'inbound',
      messageType: 'comment',
      senderExternalId: `user-${id}`,
      senderName: title,
      body,
      attachments: [],
      createdAt,
    },
  }
}

const threads = [
  thread('thread-1', 'مریم حسینی', 'قیمت دوره چقدر است؟'),
  thread('thread-2', 'رضا کاظمی', 'برای خرید عمده تخفیف دارید؟'),
]

describe('Component: InboxView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '', '/inbox')
    apiMock.post.mockResolvedValue({ ok: true })
    apiMock.getPaginated.mockResolvedValue([])
    apiMock.getPage.mockImplementation(async (url: string) => {
      if (/\/api\/inbox\/threads\/[^/]+\/messages/.test(url)) {
        const id = url.split('/')[4]
        const selected = threads.find((item) => item.id === id)
        return { data: selected ? [selected.lastMessage] : [], nextCursor: null }
      }
      if (url.startsWith('/api/inbox/threads?')) return { data: threads, nextCursor: null }
      if (url.startsWith('/api/inbox')) return { data: [], nextCursor: null }
      throw new Error(`Unexpected paginated request: ${url}`)
    })
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/api/workspace') return { id: 'workspace-1' }
      if (/^\/api\/inbox\/threads\/[^/]+\/reply-attempt$/.test(url)) return { attempt: null, canResolve: true }
      if (/^\/api\/inbox\/threads\/[^/]+\/private-reply$/.test(url)) {
        return { available: false, status: null, expiresAt: null, reason: 'unsupported' }
      }
      if (url === '/api/automation/comment-dm-rules') return []
      if (url === '/api/inbox/saved-replies') return []
      if (url === '/api/inbox/threads/counts') {
        return {
          counts: {
            all: 2,
            unread: 2,
            mine: 0,
            unassigned: 2,
            urgent: 0,
            resolved: 0,
            comment: 2,
            dm: 0,
          },
          membershipId: 'member-1',
          legacyUnread: 0,
        }
      }
      const contextMatch = url.match(/^\/api\/inbox\/threads\/([^/]+)\/context$/)
      if (contextMatch) {
        return {
          customer: { name: 'Customer', firstSeenAt: null, threadCount: 1 },
          priorThreads: [],
        }
      }
      const detailMatch = url.match(/^\/api\/inbox\/threads\/([^/]+)$/)
      if (detailMatch) {
        const selected = threads.find((item) => item.id === detailMatch[1])
        if (selected) return { ...selected, messages: [selected.lastMessage] }
      }
      throw new Error(`Unexpected request: ${url}`)
    })
  })

  it('renders thread-backed conversations', async () => {
    renderWithProviders(<InboxView />)

    expect(await screen.findByRole('button', { name: /مریم حسینی/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /رضا کاظمی/ })).toBeVisible()
  })

  it('keeps exactly one selected row visually distinct from other unread rows', async () => {
    renderWithProviders(<InboxView />)
    const first = await screen.findByRole('button', { name: /مریم حسینی/ })
    const second = screen.getByRole('button', { name: /رضا کاظمی/ })

    expect(first).toHaveClass('bg-surface-subtle')
    expect(second).toHaveClass('bg-surface-subtle')
    expect(first).not.toHaveClass('border-s-accent')
    expect(second).not.toHaveClass('border-s-accent')

    fireEvent.click(first)
    await waitFor(() => expect(first).toHaveAttribute('aria-current', 'true'))
    expect(first).toHaveClass('border-s-accent')
    expect(second).not.toHaveClass('border-s-accent')
    expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(1)
    expect(window.location.search).toBe('?thread=thread-1')

    fireEvent.click(second)
    await waitFor(() => expect(second).toHaveAttribute('aria-current', 'true'))
    expect(first).not.toHaveAttribute('aria-current')
    expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(1)
    expect(window.location.search).toBe('?thread=thread-2')
  })

  it('blocks a second send when the first thread reply outcome is uncertain', async () => {
    const replies: Array<{ reply: string; idempotencyKey: string }> = []
    apiMock.post.mockImplementation(async (url: string, body: { reply: string; idempotencyKey: string }) => {
      if (url === '/api/inbox/threads/thread-1/reply') {
        replies.push(body)
        if (replies.length === 1) {
          throw new Error(JSON.stringify({ code: 'reply_outcome_unknown', error: 'نتیجهٔ ارسال نامشخص است' }))
        }
      }
      return { ok: true }
    })
    renderWithProviders(<InboxView />)
    fireEvent.click(await screen.findByRole('button', { name: /مریم حسینی/ }))
    fireEvent.change(screen.getByPlaceholderText(/پاسخ خود را بنویسید/), { target: { value: 'یک پاسخ آزمایشی' } })
    fireEvent.click(screen.getByRole('button', { name: 'ارسال پاسخ عمومی' }))
    expect(await screen.findByText(/پاسخ دوباره غیرفعال شده است/)).toBeVisible()
    expect(screen.getByPlaceholderText(/پاسخ خود را بنویسید/)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'ارسال پاسخ عمومی' })).toBeDisabled()
    expect(replies).toHaveLength(1)
  })

  it('keeps the one-time private DM separate from the public comment composer', async () => {
    const original = apiMock.get.getMockImplementation()!
    apiMock.get.mockImplementation((url: string) => {
      if (url === '/api/inbox/threads/thread-1/private-reply') {
        return Promise.resolve({ available: true, status: null, expiresAt: null, reason: null })
      }
      return original(url)
    })
    renderWithProviders(<InboxView />)
    fireEvent.click(await screen.findByRole('button', { name: /مریم حسینی/ }))
    expect(await screen.findByRole('button', { name: 'پاسخ خصوصی در دایرکت' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'ارسال پاسخ عمومی' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'پاسخ خصوصی در دایرکت' }))
    fireEvent.change(screen.getByPlaceholderText('متن پیام خصوصی…'), { target: { value: 'سلام خصوصی' } })
    fireEvent.click(screen.getByRole('button', { name: 'تأیید و ارسال خصوصی' }))
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith(
      '/api/inbox/threads/thread-1/private-reply', { message: 'سلام خصوصی' },
    ))
    expect(apiMock.post).not.toHaveBeenCalledWith('/api/inbox/threads/thread-1/reply', expect.anything())
  })

  it('shows a failed provider delivery status on an outbound message', async () => {
    const original = apiMock.getPage.getMockImplementation()!
    apiMock.getPage.mockImplementation((url: string) => {
      if (url.startsWith('/api/inbox/threads/thread-1/messages?')) {
        return Promise.resolve({ data: [{ ...threads[0].lastMessage, id: 'out-failed',
          direction: 'outbound', deliveryStatus: 'failed' }], nextCursor: null })
      }
      return original(url)
    })
    renderWithProviders(<InboxView />)
    fireEvent.click(await screen.findByRole('button', { name: /مریم حسینی/ }))
    expect(await screen.findByText('ارسال ناموفق')).toBeVisible()
  })
})

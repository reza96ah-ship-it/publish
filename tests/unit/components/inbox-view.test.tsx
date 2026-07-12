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
})

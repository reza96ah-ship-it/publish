import { describe, expect, it, vi } from 'vitest'

import type { InboxRepository } from '@/modules/inbox/repository'
import { InboxService } from '@/modules/inbox/service'
import type { InboxMessage, InboxThreadMessage } from '@/modules/inbox/types'

const auth = { workspaceId: 'workspace-1', userId: 'user-1' }

function legacyMessage(index: number): InboxMessage {
  return {
    id: `legacy-${String(index).padStart(3, '0')}`,
    senderName: `Customer ${index}`,
    senderAvatar: null,
    message: `Message ${index}`,
    isRead: false,
    isReplied: false,
    reply: null,
    platform: 'instagram',
    platformName: 'Instagram',
    messageType: 'comment',
    assigneeId: null,
    status: 'new',
    slaStartedAt: null,
    firstResponseAt: null,
    resolvedAt: null,
    createdAt: new Date(2026, 6, 12, 12, 0, -index),
  }
}

function timelineMessage(index: number): InboxThreadMessage {
  return {
    id: `message-${String(index).padStart(3, '0')}`,
    providerMessageId: `provider-${index}`,
    direction: index % 2 === 0 ? 'inbound' : 'outbound',
    messageType: 'dm',
    senderExternalId: `customer-${index}`,
    senderName: index % 2 === 0 ? 'Customer' : 'Agent',
    body: `Timeline message ${index}`,
    attachments: [],
    createdAt: new Date(2026, 6, 12, 12, 0, -index),
  }
}

describe('InboxService pagination', () => {
  it('returns a continuation cursor after the first 20 legacy rows', async () => {
    const rows = Array.from({ length: 21 }, (_, index) => legacyMessage(index))
    const repo = { list: vi.fn().mockResolvedValue(rows) }
    const service = new InboxService(repo as unknown as InboxRepository)

    const result = await service.listMessages(auth, { limit: 20 })

    expect(result.data).toHaveLength(20)
    expect(result.nextCursor).toBe('legacy-019')
  })

  it('trims a 51-row timeline page, returns a cursor, and restores chronological order', async () => {
    const rows = Array.from({ length: 51 }, (_, index) => timelineMessage(index))
    const repo = {
      findThreadInWorkspace: vi.fn().mockResolvedValue({ id: 'thread-1' }),
      listThreadMessages: vi.fn().mockResolvedValue(rows),
    }
    const service = new InboxService(repo as unknown as InboxRepository)

    const result = await service.listThreadMessages(auth, 'thread-1', { limit: 50 })

    expect(result.data).toHaveLength(50)
    expect(result.data[0]?.id).toBe('message-049')
    expect(result.data[49]?.id).toBe('message-000')
    expect(result.nextCursor).not.toBeNull()
    expect(repo.listThreadMessages).toHaveBeenCalledWith('thread-1', 'workspace-1', {
      limit: 50,
    })
  })

  it('combines thread queue counts with compatibility unread totals', async () => {
    const counts = {
      all: 5,
      unread: 3,
      unassigned: 2,
      mine: 1,
      urgent: 1,
      comment: 3,
      dm: 2,
      mention: 0,
      resolved: 1,
    }
    const repo = {
      findMemberByUserInWorkspace: vi.fn().mockResolvedValue({ id: 'member-1' }),
      threadQueueCounts: vi.fn().mockResolvedValue(counts),
      legacyUnreadCount: vi.fn().mockResolvedValue(2),
    }
    const service = new InboxService(repo as unknown as InboxRepository)

    await expect(service.threadQueueCounts(auth)).resolves.toEqual({
      counts,
      membershipId: 'member-1',
      legacyUnread: 2,
    })
  })
})

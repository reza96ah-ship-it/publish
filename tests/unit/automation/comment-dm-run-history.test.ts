import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = vi.hoisted(() => ({
  commentDmRule: { findFirst: vi.fn() },
  commentDmLog: { findMany: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ db: dbMock }))

import { listRuleRuns } from '@/modules/automation/comment-dm'

describe('comment-to-DM run history workspace isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not read logs for a rule outside the workspace', async () => {
    dbMock.commentDmRule.findFirst.mockResolvedValue(null)
    expect(await listRuleRuns('ws-1', 'foreign-rule')).toBeNull()
    expect(dbMock.commentDmRule.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-rule', workspaceId: 'ws-1' },
      select: { id: true },
    })
    expect(dbMock.commentDmLog.findMany).not.toHaveBeenCalled()
  })

  it('limits and scopes evidence for an owned rule', async () => {
    dbMock.commentDmRule.findFirst.mockResolvedValue({ id: 'rule-1' })
    dbMock.commentDmLog.findMany.mockResolvedValue([])
    expect(await listRuleRuns('ws-1', 'rule-1')).toEqual([])
    expect(dbMock.commentDmLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: 'ws-1', ruleId: 'rule-1' },
      select: expect.objectContaining({ postId: true, providerMessageId: true }),
      orderBy: { sentAt: 'desc' },
      take: 20,
    }))
  })
})

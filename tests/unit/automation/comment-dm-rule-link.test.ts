import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = vi.hoisted(() => ({
  platform: { findFirst: vi.fn() },
  commentDmRule: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}))
vi.mock('@/lib/db', () => ({ db: dbMock }))

import { createRule, updateRule } from '@/modules/automation/comment-dm'

describe('comment-to-DM template links', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a link placeholder without a destination before saving a rule', async () => {
    await expect(createRule('workspace-1', {
      platformId: 'platform-1', keywords: ['لینک'], dmTemplate: 'ببینید: {لینک}',
    })).rejects.toThrow('لینک مقصد الزامی است')
    expect(dbMock.platform.findFirst).not.toHaveBeenCalled()
  })

  it('rejects non-HTTPS destinations', async () => {
    await expect(createRule('workspace-1', {
      platformId: 'platform-1', keywords: ['لینک'], dmTemplate: 'ببینید: {لینک}',
      buttonUrl: 'javascript:alert(1)',
    })).rejects.toThrow('HTTPS')
  })

  it('does not allow an edit to remove the URL from a live link template', async () => {
    dbMock.commentDmRule.findFirst.mockResolvedValue({
      id: 'rule-1', dmTemplate: 'ببینید: {لینک}', buttonUrl: 'https://example.com/guide',
    })
    await expect(updateRule('rule-1', 'workspace-1', { buttonUrl: null }))
      .rejects.toThrow('لینک مقصد الزامی است')
    expect(dbMock.commentDmRule.update).not.toHaveBeenCalled()
  })
})

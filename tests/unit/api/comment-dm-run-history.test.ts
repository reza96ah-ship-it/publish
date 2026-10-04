import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  enabled: vi.fn(),
  listRuleRuns: vi.fn(),
}))

vi.mock('@/lib/auth-guards', () => ({ requirePermissionApi: mocks.guard }))
vi.mock('@/lib/flags', () => ({ isEnabled: mocks.enabled }))
vi.mock('@/modules/automation/comment-dm', () => ({ listRuleRuns: mocks.listRuleRuns }))

import { GET } from '@/app/api/automation/comment-dm-rules/[id]/logs/route'

const ruleId = 'cmuofkvee000101nzzmpp187e'
const params = { params: Promise.resolve({ id: ruleId }) }

describe('comment-to-DM run history API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.guard.mockResolvedValue({ error: null, workspaceId: 'ws-1' })
    mocks.enabled.mockResolvedValue(true)
    mocks.listRuleRuns.mockResolvedValue([])
  })

  it('requires publishing permission', async () => {
    mocks.guard.mockResolvedValue({ error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) })
    const response = await GET(new NextRequest('http://localhost'), params)
    expect(response.status).toBe(403)
    expect(mocks.listRuleRuns).not.toHaveBeenCalled()
  })

  it('honors the workspace feature flag', async () => {
    mocks.enabled.mockResolvedValue(false)
    const response = await GET(new NextRequest('http://localhost'), params)
    expect(response.status).toBe(403)
    expect(mocks.enabled).toHaveBeenCalledWith('comment_dm_beta', 'ws-1')
    expect(mocks.listRuleRuns).not.toHaveBeenCalled()
  })

  it('loads only the authenticated workspace and returns 404 for a foreign rule', async () => {
    mocks.listRuleRuns.mockResolvedValue(null)
    const response = await GET(new NextRequest('http://localhost'), params)
    expect(response.status).toBe(404)
    expect(mocks.listRuleRuns).toHaveBeenCalledWith('ws-1', ruleId)
  })

  it('returns evidence for an owned rule', async () => {
    const runs = [{ id: 'log-1', status: 'sent', providerMessageId: 'message-1' }]
    mocks.listRuleRuns.mockResolvedValue(runs)
    const response = await GET(new NextRequest('http://localhost'), params)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ runs })
  })
})

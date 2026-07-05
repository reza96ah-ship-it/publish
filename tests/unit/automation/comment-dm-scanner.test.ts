import { describe, it, expect, beforeEach, vi } from 'vitest'

// vi.mock factories are hoisted above imports — use vi.hoisted() so the mock
// object exists before the factory runs.
const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    commentDmRule: { findMany: vi.fn() },
    commentDmLog: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn() },
    publication: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}))

vi.mock('../../../mini-services/publish-worker/lib/db', () => ({ db: dbMock }))
vi.mock('../../../mini-services/publish-worker/lib/crypto', () => ({
  decrypt: vi.fn((value: string) => value),
}))

// Import the scanner AFTER mocks are registered.
import { scanCommentDms } from '../../../mini-services/publish-worker/lib/comment-dm-scanner'
import type { IgComment } from '../../../mini-services/publish-worker/lib/instagram-messaging'

const NOW = new Date('2026-07-05T10:00:00Z')

const baseRule = {
  id: 'rule_1',
  workspaceId: 'ws_1',
  platformId: 'plat_1',
  publicationId: null,
  igPostId: 'ig_media_123',
  keyword: 'قیمت',
  keywords: ['قیمت'],
  excludeKeywords: ['گران'],
  dmTemplate: 'سلام {نام} عزیز، لینک: x.com',
  buttonText: null,
  buttonUrl: null,
  publicReply: null,
  optOutKeyword: 'نه',
  freqCapHours: 24,
  platform: {
    tokenSecret: 'enc:key:iv:ct:tag',
    targetId: 'ig_user_456',
    name: 'برند',
  },
}

function makeComment(overrides: Partial<IgComment> = {}): IgComment {
  return {
    id: 'cmt_' + Math.random().toString(36).slice(2, 8),
    text: 'قیمت چنده؟',
    username: 'reza',
    from: { id: 'ig_user_reza', username: 'reza' },
    timestamp: NOW.toISOString(),
    ...overrides,
  }
}

/** Wire up a full scan with the given rule + comments + IG API mocks. */
async function runScan(opts: {
  rules?: unknown[]
  commentsPerMedia?: Record<string, IgComment[]>
  existingLogs?: Record<string, { status: string }>
  recentSentCount?: number
  sendDm?: (token: string, igUserId: string, commentId: string, text: string) => Promise<unknown>
  replyComment?: (token: string, commentId: string, text: string) => Promise<unknown>
}) {
  const rules = opts.rules ?? [baseRule]
  const commentsPerMedia = opts.commentsPerMedia ?? { ig_media_123: [makeComment()] }
  const sendDm = opts.sendDm ?? vi.fn(async () => ({ messageId: 'm1', recipientId: 'r1' }))
  const replyComment = opts.replyComment ?? vi.fn(async () => ({ id: 'r1' }))

  dbMock.commentDmRule.findMany.mockResolvedValue(rules)
  dbMock.commentDmLog.findUnique.mockImplementation((args: { where: { ruleId_commentId: { ruleId: string; commentId: string } } }) => {
    const key = `${args.where.ruleId_commentId.ruleId}:${args.where.ruleId_commentId.commentId}`
    return Promise.resolve(opts.existingLogs?.[key] ?? null)
  })
  dbMock.commentDmLog.count.mockResolvedValue(opts.recentSentCount ?? 0)
  dbMock.commentDmLog.create.mockResolvedValue({ id: 'log_1' })

  const listComments = vi.fn(async (_token: string, mediaId: string) =>
    Promise.resolve(commentsPerMedia[mediaId] ?? [])
  )

  const stats = await scanCommentDms(NOW, { listComments, sendDm, replyComment })

  return { stats, listComments, sendDm, replyComment }
}

describe('comment-dm-scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scans a rule, matches a comment, sends a DM, logs as sent', async () => {
    const { stats, sendDm } = await runScan({
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت؟' })] },
    })
    expect(stats.rulesScanned).toBe(1)
    expect(stats.commentsChecked).toBe(1)
    expect(stats.dmsSent).toBe(1)
    expect(sendDm).toHaveBeenCalledOnce()
    // Verify DM text has the sender name interpolated.
    const callArgs = (sendDm as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(callArgs?.[3]).toContain('reza')
    // Log should be created with status='sent'.
    expect(dbMock.commentDmLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'sent' }) })
    )
  })

  it('skips a comment that does not match any keyword (logs skipped)', async () => {
    const { stats, sendDm } = await runScan({
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'سلام خوبی؟' })] },
    })
    expect(stats.dmsSent).toBe(0)
    expect(stats.dmsSkipped).toBe(1)
    expect(sendDm).not.toHaveBeenCalled()
    expect(dbMock.commentDmLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'skipped' }) })
    )
  })

  it('skips a comment that hits an exclude keyword', async () => {
    const { stats, sendDm } = await runScan({
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت گران' })] },
    })
    expect(stats.dmsSkipped).toBe(1)
    expect(stats.dmsSent).toBe(0)
    expect(sendDm).not.toHaveBeenCalled()
  })

  it('skips a comment containing the opt-out keyword', async () => {
    const { stats, sendDm } = await runScan({
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت نه' })] },
    })
    expect(stats.dmsSkipped).toBe(1)
    expect(stats.dmsSent).toBe(0)
  })

  it('skips a comment already processed (existing CommentDmLog)', async () => {
    const comment = makeComment({ id: 'cmt_dup' })
    const { stats, sendDm } = await runScan({
      commentsPerMedia: { ig_media_123: [comment] },
      existingLogs: { 'rule_1:cmt_dup': { status: 'sent' } },
    })
    expect(stats.dmsSkipped).toBe(1)
    expect(stats.dmsSent).toBe(0)
    expect(sendDm).not.toHaveBeenCalled()
    // Should NOT create a new log row (idempotent).
    expect(dbMock.commentDmLog.create).not.toHaveBeenCalled()
  })

  it('skips when frequency cap is active (recent sent to same sender)', async () => {
    const { stats, sendDm } = await runScan({
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت' })] },
      recentSentCount: 1,
    })
    expect(stats.dmsSkipped).toBe(1)
    expect(stats.dmsSent).toBe(0)
  })

  it('posts a public reply before sending DM when rule.publicReply is set', async () => {
    const ruleWithReply = { ...baseRule, publicReply: 'دایرکت شد ✉️' }
    const replyComment = vi.fn(async () => ({ id: 'reply_1' }))
    const { stats, sendDm: sendDmFn, replyComment: replyFn } = await runScan({
      rules: [ruleWithReply],
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت' })] },
      replyComment,
    })
    expect(stats.dmsSent).toBe(1)
    expect(stats.publicReplies).toBe(1)
    expect(replyFn).toHaveBeenCalledOnce()
    // Verify reply was called before DM by inspecting invocation order.
    const replyOrder = replyFn.mock.invocationCallOrder[0]
    const dmOrder = (sendDmFn as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    expect(replyOrder).toBeLessThan(dmOrder)
  })

  it('continues sending DM even if public reply fails', async () => {
    const ruleWithReply = { ...baseRule, publicReply: 'دایرکت شد' }
    const replyComment = vi.fn(async () => {
      throw new Error('IG 403')
    })
    const { stats, sendDm } = await runScan({
      rules: [ruleWithReply],
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت' })] },
      replyComment,
    })
    expect(stats.dmsSent).toBe(1)
    expect(sendDm).toHaveBeenCalledOnce()
  })

  it('logs failed when DM send throws', async () => {
    const sendDm = vi.fn(async () => {
      throw new Error('IG API 500')
    })
    const { stats } = await runScan({
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت' })] },
      sendDm,
    })
    expect(stats.dmsFailed).toBe(1)
    expect(stats.dmsSent).toBe(0)
    expect(dbMock.commentDmLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) })
    )
  })

  it('scans all successful publications for a workspace-wide rule', async () => {
    const wsRule = { ...baseRule, igPostId: null, publicationId: null }
    dbMock.publication.findMany.mockResolvedValue([
      { providerPostId: 'media_A' },
      { providerPostId: 'media_B' },
    ])
    const { stats, listComments } = await runScan({
      rules: [wsRule],
      commentsPerMedia: {
        media_A: [makeComment({ text: 'قیمت' })],
        media_B: [makeComment({ text: 'سلام' })],
      },
    })
    expect(stats.mediaScanned).toBe(2)
    expect(stats.commentsChecked).toBe(2)
    expect(stats.dmsSent).toBe(1) // only media_A's comment matched
    expect(listComments).toHaveBeenCalledTimes(2)
  })

  it('scans only the rule publication when publicationId is set', async () => {
    const pubRule = { ...baseRule, igPostId: null, publicationId: 'pub_1' }
    dbMock.publication.findUnique.mockResolvedValue({
      providerPostId: 'media_X',
      status: 'success',
    })
    const { stats, listComments } = await runScan({
      rules: [pubRule],
      commentsPerMedia: { media_X: [makeComment({ text: 'قیمت' })] },
    })
    expect(dbMock.publication.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pub_1' } })
    )
    expect(stats.mediaScanned).toBe(1)
    expect(listComments).toHaveBeenCalledWith(expect.any(String), 'media_X')
  })

  it('skips a rule whose publication has no providerPostId yet', async () => {
    const pubRule = { ...baseRule, igPostId: null, publicationId: 'pub_1' }
    dbMock.publication.findUnique.mockResolvedValue({ providerPostId: null, status: 'pending' })
    const { stats, listComments } = await runScan({ rules: [pubRule] })
    expect(stats.mediaScanned).toBe(0)
    expect(listComments).not.toHaveBeenCalled()
  })

  it('returns zero stats when no active rules exist', async () => {
    const { stats } = await runScan({ rules: [] })
    expect(stats).toEqual({
      rulesScanned: 0,
      mediaScanned: 0,
      commentsChecked: 0,
      dmsSent: 0,
      dmsSkipped: 0,
      dmsFailed: 0,
      publicReplies: 0,
    })
  })

  it('ignores P2002 unique violation on log create (race condition)', async () => {
    const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    dbMock.commentDmLog.create.mockRejectedValue(p2002)
    const { stats } = await runScan({
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت' })] },
    })
    // Should not throw — P2002 is swallowed, comment still counts as sent.
    expect(stats.dmsSent).toBe(1)
  })

  it('skips a rule with no resolvable media IDs', async () => {
    const wsRule = { ...baseRule, igPostId: null, publicationId: null }
    dbMock.publication.findMany.mockResolvedValue([])
    const { stats } = await runScan({ rules: [wsRule] })
    expect(stats.mediaScanned).toBe(0)
    expect(stats.commentsChecked).toBe(0)
  })

  it('continues scanning other media when one media listComments fails', async () => {
    const wsRule = { ...baseRule, igPostId: null, publicationId: null }
    dbMock.publication.findMany.mockResolvedValue([
      { providerPostId: 'media_bad' },
      { providerPostId: 'media_ok' },
    ])
    const listComments = vi.fn(async (_t: string, mediaId: string) => {
      if (mediaId === 'media_bad') throw new Error('IG 500')
      return [makeComment({ text: 'قیمت' })]
    })
    const stats = await scanCommentDms(NOW, { listComments, sendDm: vi.fn(async () => ({ messageId: 'm' })), replyComment: vi.fn(async () => ({ id: 'r' })) })
    expect(stats.mediaScanned).toBe(2)
    expect(stats.dmsSent).toBe(1) // only media_ok's comment was processed
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'

// vi.mock factories are hoisted above imports — use vi.hoisted() so the mock
// object exists before the factory runs.
const { dbMock, zernioMock } = vi.hoisted(() => ({
  dbMock: {
    platform: { findMany: vi.fn() },
    commentDmRule: { findMany: vi.fn() },
    commentDmLog: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    providerWebhookEvent: { findMany: vi.fn(), update: vi.fn() },
    publication: { findUnique: vi.fn(), findMany: vi.fn() },
  },
  zernioMock: { privateReply: vi.fn(), publicReply: vi.fn() },
}))

vi.mock('../../../mini-services/publish-worker/lib/db', () => ({ db: dbMock }))
vi.mock('../../../mini-services/publish-worker/lib/crypto', () => ({
  decrypt: vi.fn((value: string) => value),
}))
vi.mock('../../../mini-services/publish-worker/lib/zernio-comment-reply', () => ({
  sendZernioPrivateCommentReply: zernioMock.privateReply,
  sendZernioPublicCommentReply: zernioMock.publicReply,
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
  createImpl?: (args: { data: { status: string } }) => Promise<unknown>
  sendDm?: (token: string, igUserId: string, commentId: string, text: string) => Promise<unknown>
  replyComment?: (token: string, commentId: string, text: string) => Promise<unknown>
}) {
  const rules = opts.rules ?? [baseRule]
  const commentsPerMedia = opts.commentsPerMedia ?? { ig_media_123: [makeComment()] }
  const sendDm = opts.sendDm ?? vi.fn(async () => ({ messageId: 'm1', recipientId: 'r1' }))
  const replyComment = opts.replyComment ?? vi.fn(async () => ({ id: 'r1' }))

  dbMock.commentDmRule.findMany.mockResolvedValue(rules)
  dbMock.platform.findMany.mockResolvedValue([])
  dbMock.commentDmLog.findUnique.mockImplementation((args: { where: { ruleId_commentId: { ruleId: string; commentId: string } } }) => {
    const key = `${args.where.ruleId_commentId.ruleId}:${args.where.ruleId_commentId.commentId}`
    return Promise.resolve(opts.existingLogs?.[key] ?? null)
  })
  dbMock.commentDmLog.count.mockResolvedValue(opts.recentSentCount ?? 0)
  if (opts.createImpl) {
    dbMock.commentDmLog.create.mockImplementation(opts.createImpl)
  } else {
    dbMock.commentDmLog.create.mockResolvedValue({ id: 'log_1' })
  }
  dbMock.commentDmLog.update.mockResolvedValue({ id: 'log_1' })

  const listComments = vi.fn(async (_token: string, mediaId: string) =>
    Promise.resolve(commentsPerMedia[mediaId] ?? [])
  )

  const stats = await scanCommentDms(NOW, { listComments, sendDm, replyComment })

  return { stats, listComments, sendDm, replyComment }
}

describe('comment-dm-scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.platform.findMany.mockResolvedValue([])
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
    // Claim is pending until a provider receipt is recorded.
    expect(dbMock.commentDmLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'pending' }) })
    )
    expect(dbMock.commentDmLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'sent', providerMessageId: 'm1' }) })
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

  it('posts a public reply only after the DM receipt is recorded', async () => {
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
    // The public "DM sent" statement must not precede the actual DM.
    const replyOrder = replyFn.mock.invocationCallOrder[0]
    const dmOrder = (sendDmFn as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    expect(dmOrder).toBeLessThan(replyOrder)
    expect(dbMock.commentDmLog.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'sent', publicReplyStatus: 'pending' }),
    }))
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
    expect(stats.publicReplies).toBe(0)
    expect(sendDm).toHaveBeenCalledOnce()
    expect(dbMock.commentDmLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'partial', publicReplyStatus: 'unknown' }) })
    )
  })

  it('does not claim a public reply succeeded without its provider receipt', async () => {
    const ruleWithReply = { ...baseRule, publicReply: 'دایرکت شد' }
    const replyComment = vi.fn(async () => ({ id: null }))
    const { stats } = await runScan({
      rules: [ruleWithReply],
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت' })] },
      replyComment,
    })
    expect(stats.dmsSent).toBe(1)
    expect(stats.publicReplies).toBe(0)
    expect(dbMock.commentDmLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        status: 'partial', publicReplyStatus: 'unknown', errorCode: 'public_reply_unconfirmed',
      }) })
    )
  })

  it('confirms a Zernio private reply before posting the configured public reply', async () => {
    const zernioRule = { ...baseRule, publicReply: 'دایرکت شد', publication: null }
    dbMock.platform.findMany.mockResolvedValue([{ id: 'plat_1', providerAccountId: 'acct_1' }])
    dbMock.commentDmRule.findMany.mockImplementation((args: { where: { platform: { provider: string } } }) =>
      Promise.resolve(args.where.platform.provider === 'zernio' ? [zernioRule] : []))
    dbMock.providerWebhookEvent.findMany.mockResolvedValue([{
      id: 'event_1', providerAccountId: 'acct_1', receivedAt: NOW,
      payload: { comment: {
        id: 'comment_1', platform: 'instagram', platformPostId: 'ig_media_123',
        text: 'قیمت', isReply: false, createdAt: NOW.toISOString(),
        author: { id: 'author_1', username: 'reza', isOwnAccount: false },
      } },
    }])
    dbMock.commentDmLog.findUnique.mockResolvedValue(null)
    dbMock.commentDmLog.count.mockResolvedValue(0)
    dbMock.commentDmLog.create.mockResolvedValue({ id: 'log_1' })
    dbMock.commentDmLog.update.mockResolvedValue({ id: 'log_1' })
    dbMock.providerWebhookEvent.update.mockResolvedValue({ id: 'event_1' })
    zernioMock.privateReply.mockResolvedValue({ messageId: 'message_1', recipientId: null })
    zernioMock.publicReply.mockResolvedValue({ id: 'reply_1' })

    const stats = await scanCommentDms(NOW)
    expect(stats.dmsSent).toBe(1)
    expect(stats.publicReplies).toBe(1)
    expect(zernioMock.privateReply).toHaveBeenCalledWith('acct_1', 'ig_media_123', 'comment_1', expect.any(String))
    expect(zernioMock.privateReply.mock.invocationCallOrder[0]).toBeLessThan(zernioMock.publicReply.mock.invocationCallOrder[0])
    expect(dbMock.commentDmLog.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'sent', providerMessageId: 'message_1' }),
    }))
    expect(dbMock.providerWebhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'event_1' }, data: { automationScannedAt: NOW },
    })
  })

  it('logs an ambiguous outcome when DM send throws and never posts a public reply', async () => {
    const sendDm = vi.fn(async () => {
      throw new Error('IG API 500')
    })
    const replyComment = vi.fn(async () => ({ id: 'reply-1' }))
    const { stats } = await runScan({
      rules: [{ ...baseRule, publicReply: 'دایرکت شد' }],
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت' })] },
      sendDm,
      replyComment,
    })
    expect(stats.dmsFailed).toBe(1)
    expect(stats.dmsSent).toBe(0)
    expect(replyComment).not.toHaveBeenCalled()
    expect(dbMock.commentDmLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'pending' }) })
    )
    // No blind retry: the row stays claimed with an honest unknown outcome.
    expect(dbMock.commentDmLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'unknown', errorCode: 'dm_outcome_unknown' }) })
    )
  })

  it('does not report sent or post a public reply without a DM receipt', async () => {
    const sendDm = vi.fn(async () => ({ messageId: null, recipientId: null }))
    const replyComment = vi.fn(async () => ({ id: 'reply-1' }))
    const { stats } = await runScan({
      rules: [{ ...baseRule, publicReply: 'دایرکت شد' }],
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت' })] },
      sendDm, replyComment,
    })
    expect(stats.dmsSent).toBe(0)
    expect(stats.dmsFailed).toBe(1)
    expect(replyComment).not.toHaveBeenCalled()
    expect(dbMock.commentDmLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'unknown', errorCode: 'missing_dm_receipt' }) })
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

  it('claim-first: P2002 on the claim-create skips the comment WITHOUT calling sendDm', async () => {
    // P1-2 race condition fix: another worker claimed the comment first.
    // The claim-create throws P2002 → we skip, and critically do NOT call sendDm
    // (preventing the duplicate-DM race).
    const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    const sendDm = vi.fn(async () => ({ messageId: 'm1', recipientId: 'r1' }))
    const { stats } = await runScan({
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت' })] },
      sendDm,
      createImpl: () => Promise.reject(p2002),
    })
    expect(stats.dmsSkipped).toBe(1)
    expect(stats.dmsSent).toBe(0)
    // The critical assertion: sendDm was NOT called (no duplicate DM).
    expect(sendDm).not.toHaveBeenCalled()
  })

  it('ignores P2002 unique violation on skipped-comment log create (no-op)', async () => {
    // For skipped comments (no match / excluded / opt-out / freq-cap), the log
    // create is best-effort — P2002 just means another worker logged it first.
    // This is harmless (no external side effect), so the skip is swallowed.
    const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    const { stats } = await runScan({
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'سلام خوبی' })] },
      createImpl: (args: { data: { status: string } }) => {
        if (args.data.status === 'skipped') return Promise.reject(p2002)
        return Promise.resolve({ id: 'log_1' })
      },
    })
    // Skipped comment, P2002 swallowed — no throw.
    expect(stats.dmsSkipped).toBe(1)
    expect(stats.dmsSent).toBe(0)
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

  // ── P2-2: DM button payload ─────────────────────────────────────────────

  it('passes buttonText + buttonUrl to sendDm when the rule has them configured', async () => {
    const ruleWithButton = {
      ...baseRule,
      buttonText: 'دیدن قیمت',
      buttonUrl: 'https://shop.example.com/p/1',
    }
    const sendDm = vi.fn(async () => ({ messageId: 'm1', recipientId: 'r1' }))
    const { stats } = await runScan({
      rules: [ruleWithButton],
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت' })] },
      sendDm,
    })
    expect(stats.dmsSent).toBe(1)
    // sendDm should receive 6 args: token, igUserId, commentId, text, buttonText, buttonUrl
    const call = (sendDm as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call?.[4]).toBe('دیدن قیمت')
    expect(call?.[5]).toBe('https://shop.example.com/p/1')
  })

  it('passes null buttonText/buttonUrl to sendDm when the rule has no button', async () => {
    const sendDm = vi.fn(async () => ({ messageId: 'm1', recipientId: 'r1' }))
    await runScan({
      commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت' })] },
      sendDm,
    })
    const call = (sendDm as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call?.[4]).toBeNull()
    expect(call?.[5]).toBeNull()
  })

  // ── P2-1: beta flag honored ──────────────────────────────────────────────

  it('skips all rules when FEATURE_COMMENT_DM_BETA env is set to false', async () => {
    const prev = process.env.FEATURE_COMMENT_DM_BETA
    process.env.FEATURE_COMMENT_DM_BETA = 'false'
    try {
      const { stats, sendDm } = await runScan({
        commentsPerMedia: { ig_media_123: [makeComment({ text: 'قیمت' })] },
      })
      // Env-disabled beta → no rules scanned, no DMs sent.
      expect(stats.rulesScanned).toBe(0)
      expect(stats.dmsSent).toBe(0)
      expect(sendDm).not.toHaveBeenCalled()
    } finally {
      if (prev === undefined) delete process.env.FEATURE_COMMENT_DM_BETA
      else process.env.FEATURE_COMMENT_DM_BETA = prev
    }
  })

  // ── P1-2: overlap guard ──────────────────────────────────────────────────

  it('skips the scan cycle when a previous scan is still in progress', async () => {
    // Start a scan that blocks on a slow listComments call, then kick off a
    // second scan while the first is still running — the second should skip.
    let resolveFirst: () => void
    const firstScanPromise = new Promise<void>((r) => { resolveFirst = r })
    const listComments = vi.fn(async (_t: string, _mediaId: string) => {
      await firstScanPromise // block until the test releases us
      return [makeComment({ text: 'قیمت' })]
    })
    const sendDm = vi.fn(async () => ({ messageId: 'm' }))
    const replyComment = vi.fn(async () => ({ id: 'r' }))

    const first = scanCommentDms(NOW, { listComments, sendDm, replyComment })
    // Give the event loop a tick so the first scan sets scanInProgress=true.
    await new Promise((r) => setImmediate(r))

    const second = await scanCommentDms(NOW, { listComments, sendDm, replyComment })
    // Second scan should be skipped (all zeros).
    expect(second.rulesScanned).toBe(0)
    expect(second.dmsSent).toBe(0)

    // Release the first scan and verify it completed normally.
    resolveFirst!()
    const firstStats = await first
    expect(firstStats.rulesScanned).toBe(1)
    expect(firstStats.dmsSent).toBe(1)
  })
})

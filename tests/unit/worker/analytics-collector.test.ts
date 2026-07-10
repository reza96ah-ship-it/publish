import { describe, it, expect, beforeEach, vi } from 'vitest'

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    platform: { findMany: vi.fn() },
    publication: { findMany: vi.fn() },
    analyticsSnapshot: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    postMetricSnapshot: { upsert: vi.fn() },
  },
}))

vi.mock('../../../mini-services/publish-worker/lib/db', () => ({ db: dbMock }))
vi.mock('../../../mini-services/publish-worker/lib/crypto', () => ({
  decrypt: vi.fn((value: string) => value),
}))

import { collectAnalytics } from '../../../mini-services/publish-worker/lib/analytics-collector'

const NOW = new Date('2026-07-10T12:00:00Z')
const TODAY = '2026-07-10'

const basePlatform = {
  id: 'plat_1',
  workspaceId: 'ws_1',
  tokenSecret: 'enc_token',
  targetId: 'ig_user_1',
  name: 'اینستاگرام',
}

describe('analytics-collector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.platform.findMany.mockResolvedValue([basePlatform])
    dbMock.publication.findMany.mockResolvedValue([])
    dbMock.analyticsSnapshot.findFirst.mockResolvedValue(null)
    dbMock.analyticsSnapshot.create.mockResolvedValue({})
    dbMock.analyticsSnapshot.update.mockResolvedValue({})
    dbMock.postMetricSnapshot.upsert.mockResolvedValue({})
  })

  it('writes per-platform AND null-aggregate snapshot rows for account metrics', async () => {
    const stats = await collectAnalytics(NOW, {
      fetchAccountMetrics: vi.fn().mockResolvedValue({ followers: 1200, reach: 300 }),
      fetchPostMetrics: vi.fn(),
    })

    expect(stats.accountSnapshotsWritten).toBe(2) // followers + reach
    // 2 metrics × 2 rows (instagram + null aggregate) = 4 creates
    expect(dbMock.analyticsSnapshot.create).toHaveBeenCalledTimes(4)
    const created = dbMock.analyticsSnapshot.create.mock.calls.map(
      (c) => (c[0] as { data: Record<string, unknown> }).data
    )
    expect(created).toContainEqual({
      workspaceId: 'ws_1',
      date: TODAY,
      platform: 'instagram',
      metricType: 'followers',
      value: 1200,
    })
    expect(created).toContainEqual({
      workspaceId: 'ws_1',
      date: TODAY,
      platform: null,
      metricType: 'followers',
      value: 1200,
    })
  })

  it('updates existing rows instead of creating duplicates', async () => {
    dbMock.analyticsSnapshot.findFirst.mockResolvedValue({ id: 'snap_1' })

    await collectAnalytics(NOW, {
      fetchAccountMetrics: vi.fn().mockResolvedValue({ followers: 1300 }),
      fetchPostMetrics: vi.fn(),
    })

    expect(dbMock.analyticsSnapshot.create).not.toHaveBeenCalled()
    expect(dbMock.analyticsSnapshot.update).toHaveBeenCalledWith({
      where: { id: 'snap_1' },
      data: { value: 1300 },
    })
  })

  it('sums account metrics across multiple IG accounts in one workspace', async () => {
    dbMock.platform.findMany.mockResolvedValue([
      basePlatform,
      { ...basePlatform, id: 'plat_2', targetId: 'ig_user_2' },
    ])
    const fetchAccountMetrics = vi
      .fn()
      .mockResolvedValueOnce({ followers: 1000 })
      .mockResolvedValueOnce({ followers: 500 })

    await collectAnalytics(NOW, { fetchAccountMetrics, fetchPostMetrics: vi.fn() })

    const created = dbMock.analyticsSnapshot.create.mock.calls.map(
      (c) => (c[0] as { data: Record<string, unknown> }).data
    )
    expect(created).toContainEqual(
      expect.objectContaining({ platform: 'instagram', metricType: 'followers', value: 1500 })
    )
  })

  it('upserts PostMetricSnapshot rows for recent publications', async () => {
    dbMock.publication.findMany.mockResolvedValue([
      { id: 'pub_1', providerPostId: 'ig_media_1' },
    ])

    const stats = await collectAnalytics(NOW, {
      fetchAccountMetrics: vi.fn().mockResolvedValue({}),
      fetchPostMetrics: vi.fn().mockResolvedValue({ reach: 250, likes: 40 }),
    })

    expect(stats.postsCollected).toBe(1)
    expect(dbMock.postMetricSnapshot.upsert).toHaveBeenCalledTimes(2)
    expect(dbMock.postMetricSnapshot.upsert).toHaveBeenCalledWith({
      where: {
        publicationId_date_metricType: {
          publicationId: 'pub_1',
          date: TODAY,
          metricType: 'reach',
        },
      },
      create: {
        workspaceId: 'ws_1',
        publicationId: 'pub_1',
        date: TODAY,
        metricType: 'reach',
        value: 250,
      },
      update: { value: 250 },
    })
  })

  it('keeps going when one platform account fetch fails', async () => {
    dbMock.platform.findMany.mockResolvedValue([
      basePlatform,
      { ...basePlatform, id: 'plat_2', workspaceId: 'ws_2', targetId: 'ig_user_2' },
    ])
    const fetchAccountMetrics = vi
      .fn()
      .mockRejectedValueOnce(new Error('IG 403'))
      .mockResolvedValueOnce({ followers: 900 })

    const stats = await collectAnalytics(NOW, {
      fetchAccountMetrics,
      fetchPostMetrics: vi.fn().mockResolvedValue({}),
    })

    expect(stats.errors).toBe(1)
    const created = dbMock.analyticsSnapshot.create.mock.calls.map(
      (c) => (c[0] as { data: Record<string, unknown> }).data
    )
    expect(created).toContainEqual(
      expect.objectContaining({ workspaceId: 'ws_2', metricType: 'followers', value: 900 })
    )
  })
})

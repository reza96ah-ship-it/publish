import { afterEach, describe, expect, it, vi } from 'vitest'

import { createZernioProfile, getInstagramAccountInsights, getInstagramConnectUrl, getInstagramDailyReach, getInstagramFollowerHistory, getInstagramRangeInsights, getInstagramRecentPosts, listInstagramAccounts, ZernioApiError } from '@/lib/zernio'

const profileId = '66a1f0c2a4b9d3e8f1a2b3c4'
const otherProfileId = '66a1f0c2a4b9d3e8f1a2b3c5'
const accountId = '66b2e19d8c3f5a7e9d0b1c2d'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Zernio API boundary', () => {
  it('never calls Zernio without a server-side key', async () => {
    vi.stubEnv('ZERNIO_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(listInstagramAccounts(profileId)).rejects.toMatchObject({ code: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('creates one profile named for the workspace', async () => {
    vi.stubEnv('ZERNIO_API_KEY', 'sk_test')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ profile: { _id: profileId } }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(createZernioProfile('workspace1')).resolves.toBe(profileId)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://zernio.com/api/v1/profiles')
    expect(JSON.parse(options.body)).toEqual({ name: 'workspace_workspace1' })
    expect(options.headers.Authorization).toBe('Bearer sk_test')
  })

  it('accepts only expected HTTPS authorization hosts', async () => {
    vi.stubEnv('ZERNIO_API_KEY', 'sk_test')
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      authUrl: 'https://www.instagram.com/oauth/authorize?client_id=123',
    })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(getInstagramConnectUrl(profileId, 'https://example.com/callback?flow=abc'))
      .resolves.toContain('https://www.instagram.com/oauth/authorize')
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('profileId')).toBe(profileId)
    expect(url.searchParams.get('redirect_url')).toBe('https://example.com/callback?flow=abc')

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ authUrl: 'https://evil.example/steal' })))
    await expect(getInstagramConnectUrl(profileId, 'https://example.com/callback'))
      .rejects.toBeInstanceOf(ZernioApiError)
  })

  it('only returns Instagram accounts in the requested profile', async () => {
    vi.stubEnv('ZERNIO_API_KEY', 'sk_test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ accounts: [
      { _id: accountId, profileId: { _id: profileId }, platform: 'instagram', username: 'myshop', displayName: 'My Shop', isActive: true, profileUrl: 'https://www.instagram.com/myshop/' },
      { _id: '66b2e19d8c3f5a7e9d0b1c2e', profileId: { _id: otherProfileId }, platform: 'instagram', username: 'other', isActive: true },
      { _id: '66b2e19d8c3f5a7e9d0b1c2f', profileId: { _id: profileId }, platform: 'facebook', username: 'page', isActive: true },
    ] }))))
    await expect(listInstagramAccounts(profileId)).resolves.toEqual([{
      id: accountId,
      username: 'myshop',
      displayName: 'My Shop',
      profileUrl: 'https://www.instagram.com/myshop/',
      avatarUrl: null,
      bio: null,
      websiteUrl: null,
      followersCount: null,
      isActive: true,
    }])
  })

  it('maps profile fields and account-level insights without leaking provider metadata', async () => {
    vi.stubEnv('ZERNIO_API_KEY', 'sk_test')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ accounts: [{
        _id: accountId,
        profileId: { _id: profileId },
        platform: 'instagram',
        username: 'myshop',
        displayName: 'My Shop',
        profilePicture: 'https://scontent.example.cdninstagram.com/photo.jpg',
        followersCount: 34,
        metadata: { profileData: { bio: 'My bio', website: 'https://myshop.example/', privateToken: 'hidden' } },
        isActive: true,
      }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ metrics: {
        reach: { total: 120 }, views: { total: 240 },
        accounts_engaged: { total: 17 }, total_interactions: { total: 25 },
      } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ posts: [{
        id: 'ig-post-1', message: 'New arrival', permalink: 'https://www.instagram.com/p/abc/',
        likeCount: 12, commentCount: 3,
      }] })))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listInstagramAccounts(profileId)).resolves.toMatchObject([{
      avatarUrl: 'https://scontent.example.cdninstagram.com/photo.jpg',
      bio: 'My bio', websiteUrl: 'https://myshop.example/', followersCount: 34,
    }])
    await expect(getInstagramAccountInsights(accountId)).resolves.toEqual({
      reach: 120, views: 240, accountsEngaged: 17, totalInteractions: 25,
    })
    await expect(getInstagramRecentPosts(accountId)).resolves.toMatchObject([{
      id: 'ig-post-1', caption: 'New arrival', likeCount: 12, commentCount: 3,
    }])
  })

  it('keeps period totals separate from daily reach and empty follower history', async () => {
    vi.stubEnv('ZERNIO_API_KEY', 'sk_test')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ metrics: {
        reach: { total: 120 }, views: { total: 150 }, accounts_engaged: { total: 12 },
        total_interactions: { total: 25 }, profile_links_taps: { total: 0 },
      } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ metrics: { reach: {
        values: [{ date: '2026-09-25', value: 80 }, { date: '2026-09-26', value: 70 }],
      } } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ metrics: { follower_count: {
        total: 0, values: [],
      } } })))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getInstagramRangeInsights(accountId, '2026-09-25', '2026-09-26')).resolves.toEqual({
      reach: 120, views: 150, accountsEngaged: 12, totalInteractions: 25, profileLinksTaps: 0,
    })
    await expect(getInstagramDailyReach(accountId, '2026-09-25', '2026-09-26')).resolves.toEqual([
      { date: '2026-09-25', value: 80 }, { date: '2026-09-26', value: 70 },
    ])
    await expect(getInstagramFollowerHistory(accountId, '2026-09-25', '2026-09-26')).resolves.toEqual([])
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('metricType')).toBe('total_value')
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('metricType')).toBe('time_series')
  })
})

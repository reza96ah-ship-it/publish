import { afterEach, describe, expect, it, vi } from 'vitest'

import { createZernioProfile, getInstagramConnectUrl, listInstagramAccounts, ZernioApiError } from '@/lib/zernio'

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
      isActive: true,
    }])
  })
})

import { afterEach, describe, expect, it } from 'vitest'

import { GET } from '@/app/api/auth/clear-session/route'

describe('GET /api/auth/clear-session', () => {
  const originalNextAuthUrl = process.env.NEXTAUTH_URL

  afterEach(() => {
    if (originalNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL
    else process.env.NEXTAUTH_URL = originalNextAuthUrl
  })

  it('redirects to the configured public origin instead of the internal container host', async () => {
    process.env.NEXTAUTH_URL = 'http://localhost:3000'

    const response = await GET(new Request('http://0.0.0.0:3000/api/auth/clear-session'))

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/auth/signin?error=SessionExpired'
    )
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining('next-auth.session-token=;'),
        expect.stringContaining('__Secure-next-auth.session-token=;'),
      ])
    )
  })
})

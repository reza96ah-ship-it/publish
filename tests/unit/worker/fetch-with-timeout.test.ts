import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchWithTimeout,
  FetchTimeoutError,
  DEFAULT_FETCH_TIMEOUT_MS,
} from '../../../mini-services/publish-worker/lib/fetch-with-timeout'

describe('Issue #147 D — fetchWithTimeout', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock as any
  })

  it('resolves normally when the underlying fetch resolves before the timeout', async () => {
    const response = new Response('ok', { status: 200 })
    fetchMock.mockResolvedValueOnce(response)

    const res = await fetchWithTimeout('https://example.com/api', {}, 1000)
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // The signal must be threaded through so the underlying fetch can be aborted.
    const passedInit = fetchMock.mock.calls[0][1]
    expect(passedInit.signal).toBeInstanceOf(AbortSignal)
  })

  it('throws FetchTimeoutError when fetch never settles before the timeout', async () => {
    // Real timers (short timeout) — fake timers interact badly with the
    // bun/vitest AbortController + Promise microtask scheduling here.
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        })
    )

    await expect(fetchWithTimeout('https://example.com/slow', {}, 30)).rejects.toBeInstanceOf(
      FetchTimeoutError
    )
  }, 5000)

  it('default timeout is 15s', () => {
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBe(15_000)
  })

  it('propagates non-abort errors unchanged', async () => {
    const networkError = new Error('ECONNRESET')
    fetchMock.mockRejectedValueOnce(networkError)

    await expect(fetchWithTimeout('https://example.com/api')).rejects.toBe(networkError)
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Import after mocking fetch
const { api } = await import('../../../src/lib/api')

describe('God-node: api fetch wrapper', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('api.get()', () => {
    it('makes GET request with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      })

      const result = await api.get('/api/test')
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        headers: { 'Content-Type': 'application/json' },
      })
      expect(result).toEqual({ data: 'test' })
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('not found'),
      })

      await expect(api.get('/api/missing')).rejects.toThrow('not found')
    })

    it('throws with statusText when text() fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.reject(new Error('parse error')),
      })

      await expect(api.get('/api/error')).rejects.toThrow('Internal Server Error')
    })
  })

  describe('api.post()', () => {
    it('makes POST request with JSON body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })

      await api.post('/api/test', { name: 'test' })
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      })
    })

    it('sends no body when body is undefined', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })

      await api.post('/api/test')
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        body: undefined,
        headers: { 'Content-Type': 'application/json' },
      })
    })
  })

  describe('api.patch()', () => {
    it('makes PATCH request with JSON body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })

      await api.patch('/api/test/1', { status: 'active' })
      expect(mockFetch).toHaveBeenCalledWith('/api/test/1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
        headers: { 'Content-Type': 'application/json' },
      })
    })
  })

  describe('api.delete()', () => {
    it('makes DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })

      await api.delete('/api/test/1')
      expect(mockFetch).toHaveBeenCalledWith('/api/test/1', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
    })
  })

  describe('Content-Type header', () => {
    it('always includes Content-Type: application/json', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await api.get('/api/test')
      const call = mockFetch.mock.calls[0]
      expect(call[1].headers['Content-Type']).toBe('application/json')
    })

  })

  describe('error handling', () => {
    it('throws on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network error'))
      await expect(api.get('/api/test')).rejects.toThrow('network error')
    })

    it('includes error message from response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('موضوع الزامی است'),
      })

      await expect(api.get('/api/test')).rejects.toThrow('موضوع الزامی است')
    })
  })
})

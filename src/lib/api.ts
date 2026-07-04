// Typed API helpers for the Nashrino backend (Next.js route handlers).

export interface PaginatedResponse<T> {
  data: T[]
  nextCursor: string | null
}

async function fetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(msg || `خطای سرور (${res.status})`)
  }
  // 204 No Content (e.g. DELETE routes) has no body to parse
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(url: string) => fetcher<T>(url),
  getPaginated: async <T>(url: string) => {
    const page = await fetcher<PaginatedResponse<T>>(url)
    return page.data
  },
  post: <T>(url: string, body?: unknown) =>
    fetcher<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: unknown) =>
    fetcher<T>(url, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(url: string) => fetcher<T>(url, { method: 'DELETE' }),
}

// Typed API helpers for the Nashrino backend (Next.js route handlers).

async function fetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(msg || `خطای سرور (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(url: string) => fetcher<T>(url),
  post: <T>(url: string, body?: unknown) =>
    fetcher<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: unknown) =>
    fetcher<T>(url, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(url: string) => fetcher<T>(url, { method: 'DELETE' }),
}

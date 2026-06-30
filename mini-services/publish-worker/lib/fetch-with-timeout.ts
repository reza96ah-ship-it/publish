/**
 * Shared timeout wrapper for outbound provider HTTP calls. (Issue #147 D)
 *
 * None of the channel adapters' `fetch()` calls had a timeout or
 * AbortController before this — a hung connection to a provider could block
 * a worker slot (and the BullMQ job) indefinitely.
 *
 * On timeout we genuinely don't know whether the provider received and
 * processed the request — naively retrying risks creating a duplicate post.
 * Callers should catch `FetchTimeoutError` and surface it as an ambiguous
 * outcome (`PublishResult.outcomeUnknown = true`), which the retry-directive
 * normalizer maps to `outcome_unknown` rather than `retry`.
 */

export const DEFAULT_FETCH_TIMEOUT_MS = 15_000

export class FetchTimeoutError extends Error {
  constructor(
    public readonly url: string,
    public readonly timeoutMs: number
  ) {
    super(`درخواست به ${url} پس از ${timeoutMs}ms بدون پاسخ ماند (timeout) — وضعیت ارسال نامشخص است`)
    this.name = 'FetchTimeoutError'
  }
}

/**
 * fetch() with an AbortController-based timeout. Behaves identically to
 * `fetch` otherwise — same signature, same Response. On timeout, throws
 * `FetchTimeoutError` instead of the raw DOMException/AbortError so callers
 * can distinguish "we aborted because of our own timeout" from other
 * network failures.
 */
export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new FetchTimeoutError(String(input), timeoutMs)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

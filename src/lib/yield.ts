/**
 * scheduler.yield() polyfill — yields to the main thread to prevent INP jank.
 *
 * Usage in list rendering:
 *   for (const item of items) {
 *     render(item)
 *     await yieldToMain()  // let the browser handle input/events
 *   }
 *
 * Browser support: Chrome 129+ (scheduler.yield), Safari/FF fallback to setTimeout.
 */

export function yieldToMain(): Promise<void> {
  // Use globalThis to avoid TypeScript error (scheduler is not in TS lib yet)
  const s = (globalThis as any).scheduler
  if (s && typeof s.yield === 'function') {
    return s.yield()
  }
  return new Promise((resolve) => setTimeout(resolve, 0))
}

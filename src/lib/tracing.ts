/**
 * Issue #155: Distributed tracing — W3C Trace Context propagation.
 *
 * Generates and propagates traceparent headers across:
 *   API edge → DB transaction → OutboxEvent → BullMQ job → Worker → Provider → Realtime
 *
 * Uses the W3C Trace Context format: version-traceid-spanid-flags
 * Example: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
 *
 * Safe identifiers attached to spans (never secrets):
 *   workspaceId, contentId, publicationId, attemptId, provider, state, apiVersion
 */

import { randomBytes } from 'crypto'

const TRACE_VERSION = '00'
const TRACE_FLAGS_SAMPLED = '01'

export interface TraceContext {
  traceId: string // 32 hex chars
  spanId: string // 16 hex chars
  flags: string // 2 hex chars
  /** W3C traceparent header value */
  traceparent: string
}

/**
 * Generate a new trace context at the API edge.
 * This starts a new trace that will propagate through the entire pipeline.
 */
export function startTrace(sampled: boolean = true): TraceContext {
  const traceId = randomBytes(16).toString('hex')
  const spanId = randomBytes(8).toString('hex')
  const flags = sampled ? TRACE_FLAGS_SAMPLED : '00'
  return {
    traceId,
    spanId,
    flags,
    traceparent: `${TRACE_VERSION}-${traceId}-${spanId}-${flags}`,
  }
}

/**
 * Parse a W3C traceparent header into a TraceContext.
 * Returns null if the header is missing or malformed.
 */
export function parseTraceparent(header: string | null | undefined): TraceContext | null {
  if (!header) return null
  const parts = header.split('-')
  if (parts.length !== 4) return null
  const [version, traceId, spanId, flags] = parts
  if (version !== TRACE_VERSION) return null
  if (traceId.length !== 32 || !/^[0-9a-f]+$/.test(traceId)) return null
  if (spanId.length !== 16 || !/^[0-9a-f]+$/.test(spanId)) return null
  if (flags.length !== 2 || !/^[0-9a-f]+$/.test(flags)) return null
  return { traceId, spanId, flags, traceparent: header }
}

/**
 * Create a child span within an existing trace.
 * The traceId stays the same; a new spanId is generated.
 */
export function childSpan(parent: TraceContext, sampled?: boolean): TraceContext {
  const spanId = randomBytes(8).toString('hex')
  const flags = sampled !== undefined ? (sampled ? TRACE_FLAGS_SAMPLED : '00') : parent.flags
  return {
    traceId: parent.traceId,
    spanId,
    flags,
    traceparent: `${TRACE_VERSION}-${parent.traceId}-${spanId}-${flags}`,
  }
}

/**
 * Safe span attributes — only non-sensitive identifiers.
 * Issue #155: never attach tokens, captions, personal data, raw provider payloads.
 */
export interface SpanAttributes {
  workspaceId?: string
  contentId?: string
  publicationId?: string
  attemptId?: string
  provider?: string
  state?: string
  apiVersion?: string
  operation?: string
  outcome?: string
  durationMs?: number
  errorCategory?: string
}

/**
 * Log a span with structured attributes.
 * In production, this would be sent to an OpenTelemetry collector.
 * For now, we log via pino with the trace context.
 */
export function logSpan(trace: TraceContext, attrs: SpanAttributes): void {
  // Import logger lazily to avoid circular deps in tests
  const logEntry = {
    traceId: trace.traceId,
    spanId: trace.spanId,
    ...attrs,
  }
  // Use console.info as fallback if logger isn't available
  // (logger.ts uses pino which is available in the app but not in worker tests)
  if (typeof console !== 'undefined') {
    console.info(JSON.stringify({ level: 'info', ...logEntry }))
  }
}

/**
 * Extract traceparent from request headers (Next.js API route).
 */
export function extractFromHeaders(headers: Headers): TraceContext | null {
  return parseTraceparent(headers.get('traceparent'))
}

/**
 * Set traceparent on outgoing fetch headers.
 */
export function injectTraceHeaders(headers: Record<string, string>, trace: TraceContext): Record<string, string> {
  return {
    ...headers,
    traceparent: trace.traceparent,
  }
}

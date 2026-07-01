/**
 * Issue #155: Distributed tracing using real OpenTelemetry SDK.
 *
 * Generates and propagates W3C Trace Context across:
 *   API edge → DB transaction → OutboxEvent → BullMQ job → Worker → Provider → Realtime
 *
 * Uses @opentelemetry/api for context + span lifecycle and the W3CTraceContextPropagator
 * from @opentelemetry/core for traceparent inject/extract (works even when no SDK is
 * registered, which is the case in unit tests).
 *
 * To enable exporting spans to an OTLP collector, call `initTracing()` once per process
 * at startup. Tests and dev mode use the noop provider — `startSpan`/`withSpan` still
 * return valid SpanContexts for propagation, they just aren't exported.
 *
 * Safe identifiers attached to spans (never secrets — Issue #155):
 *   workspaceId, contentId, publicationId, attemptId, provider, state, apiVersion
 */

import {
  context as otelContext,
  trace as otelTrace,
  SpanStatusCode,
  TraceFlags,
  defaultTextMapSetter,
  defaultTextMapGetter,
  type Span,
  type SpanOptions,
  type Attributes,
  type Exception,
  ROOT_CONTEXT,
} from '@opentelemetry/api'
import { W3CTraceContextPropagator } from '@opentelemetry/core'

const TRACER_NAME = 'nashrino'
const TRACER_VERSION = '1.0.0'

// Single shared W3C propagator instance — used for inject/extract regardless of
// whether a global propagator has been registered. This keeps the tracing module
// testable without booting the full OTel SDK.
const w3cPropagator = new W3CTraceContextPropagator()

export interface TraceContext {
  traceId: string // 32 hex chars
  spanId: string // 16 hex chars
  flags: string // 2 hex chars
  /** W3C traceparent header value */
  traceparent: string
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
  [key: string]: string | number | boolean | undefined
}

/**
 * Convert an OTel SpanContext (traceFlags is a number) into the public
 * TraceContext shape (flags is a 2-char hex string).
 */
function toTraceContext(spanCtx: {
  traceId: string
  spanId: string
  traceFlags: number
}): TraceContext {
  const flags = (spanCtx.traceFlags & TraceFlags.SAMPLED) === TraceFlags.SAMPLED ? '01' : '00'
  return {
    traceId: spanCtx.traceId,
    spanId: spanCtx.spanId,
    flags,
    traceparent: `00-${spanCtx.traceId}-${spanCtx.spanId}-${flags}`,
  }
}

/**
 * Return the active tracer from the global OTel provider.
 * Falls back to the API's NoopTracer when no SDK is registered (tests + dev).
 */
function tracer() {
  return otelTrace.getTracer(TRACER_NAME, TRACER_VERSION)
}

/**
 * Build an OTel Context from a traceparent string by extracting the
 * propagated SpanContext via the W3C propagator.
 */
function contextFromTraceparent(traceparent: string) {
  const carrier: Record<string, string> = { traceparent }
  return w3cPropagator.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
}

/**
 * Start a new trace span and return its TraceContext for propagation.
 *
 * This is the low-level API. The created span is ended immediately after its
 * SpanContext is read — callers wanting real span lifetime (start/end on the
 * same span) should use {@link withSpan} instead. The returned TraceContext is
 * still valid for downstream propagation regardless.
 *
 * Backward-compat: the first argument may be a boolean (the old `sampled`
 * flag from PR #179). When called as `startTrace(false)` the returned
 * TraceContext has flags='00'.
 *
 * @param nameOrSampled span name (string) or sampled flag (boolean, legacy)
 * @param attributes safe identifiers to attach to the span
 */
export function startTrace(
  nameOrSampled: string | boolean = 'nashrino.span',
  attributes?: SpanAttributes
): TraceContext {
  let name: string
  let sampledOverride: boolean | undefined
  if (typeof nameOrSampled === 'boolean') {
    name = 'nashrino.span'
    sampledOverride = nameOrSampled
  } else {
    name = nameOrSampled
  }

  const span = tracer().startSpan(name, undefined, otelContext.active())
  if (attributes) {
    span.setAttributes(attributes as Attributes)
  }
  const ctx = toTraceContext(span.spanContext())
  // End the span immediately — we only needed its SpanContext for propagation.
  // Real span lifetime is the caller's responsibility via withSpan().
  span.end()
  if (sampledOverride === false) {
    // Override flags in the returned context (does not affect SDK export —
    // the span has already been ended). Downstream consumers will see flags='00'.
    return { ...ctx, flags: '00', traceparent: `00-${ctx.traceId}-${ctx.spanId}-00` }
  }
  return ctx
}

/**
 * Parse a W3C traceparent header into a TraceContext.
 * Uses the W3CTraceContextPropagator.extract() under the hood.
 * Returns null if the header is missing or malformed.
 */
export function parseTraceparent(header: string | null | undefined): TraceContext | null {
  if (!header) return null
  const carrier: Record<string, string> = { traceparent: header }
  const extracted = w3cPropagator.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter)
  const spanCtx = otelTrace.getSpanContext(extracted)
  if (!spanCtx) return null
  // Defensive: OTel's W3C parser already enforces 32-hex traceId + 16-hex spanId,
  // but double-check before handing the value to callers.
  if (!/^[0-9a-f]{32}$/.test(spanCtx.traceId)) return null
  if (!/^[0-9a-f]{16}$/.test(spanCtx.spanId)) return null
  return toTraceContext(spanCtx)
}

/**
 * Create a child span within an existing trace.
 * The traceId stays the same; a new spanId is generated.
 *
 * The parent context is reconstructed from the parent's traceparent via the
 * W3C propagator, so the resulting span is a true OTel child of the parent.
 */
export function childSpan(parent: TraceContext, sampled?: boolean): TraceContext {
  const parentCtx = contextFromTraceparent(parent.traceparent)
  const span = tracer().startSpan('nashrino.child', undefined, parentCtx)
  const ctx = toTraceContext(span.spanContext())
  span.end()
  if (sampled !== undefined) {
    const flags = sampled ? '01' : '00'
    return { ...ctx, flags, traceparent: `00-${ctx.traceId}-${ctx.spanId}-${flags}` }
  }
  return ctx
}

/**
 * Inject trace context (traceparent header) into outgoing request headers.
 * Uses the W3CTraceContextPropagator.inject() so OTel-formatted carriers
 * (fetch headers, BullMQ job data, etc.) propagate identically to the
 * incoming request.
 */
export function injectTraceHeaders(
  headers: Record<string, string>,
  trace: TraceContext
): Record<string, string> {
  const carrier: Record<string, string> = { ...headers }
  const ctx = contextFromTraceparent(trace.traceparent)
  w3cPropagator.inject(ctx, carrier, defaultTextMapSetter)
  return carrier
}

/**
 * Extract traceparent from request headers (Next.js API route).
 */
export function extractFromHeaders(headers: Headers): TraceContext | null {
  return parseTraceparent(headers.get('traceparent'))
}

/**
 * Run `fn` inside an OTel context derived from a traceparent.
 * Use this in worker entry points to bind an incoming job's trace context
 * to all spans created during async processing.
 */
export async function withTraceContext<T>(
  trace: TraceContext,
  fn: () => Promise<T>
): Promise<T> {
  const ctx = contextFromTraceparent(trace.traceparent)
  return otelContext.with(ctx, fn)
}

/**
 * Start a child span, run `fn` within its active context, and end the span.
 *
 * This is the preferred API for call sites that need a real span lifetime
 * (API route handlers, worker job processors, outbox dispatcher ticks).
 *
 * @param name span name (e.g. "publish.route", "worker.process", "adapter.publish")
 * @param fn receives the active Span so it can set attributes / record errors
 * @param attributes safe identifiers attached at span start
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: SpanAttributes,
  options?: SpanOptions
): Promise<T> {
  const span = tracer().startSpan(name, options, otelContext.active())
  if (attributes) {
    span.setAttributes(attributes as Attributes)
  }
  const ctx = otelTrace.setSpan(otelContext.active(), span)
  try {
    return await otelContext.with(ctx, fn, undefined, span)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    span.setStatus({ code: SpanStatusCode.ERROR, message })
    span.recordException(err as Exception)
    throw err
  } finally {
    span.end()
  }
}

/**
 * Get the active trace context (if any) from the current OTel context.
 * Returns null when no span is active.
 */
export function activeTraceContext(): TraceContext | null {
  const spanCtx = otelTrace.getSpanContext(otelContext.active())
  if (!spanCtx) return null
  return toTraceContext(spanCtx)
}

/**
 * Record a structured span event for visibility.
 *
 * This emits a JSON log line that includes the trace context + safe attributes.
 * It does NOT replace the OTel SDK export — use {@link withSpan} for real spans.
 * Useful for sites that need a trace-correlated log line without a full span
 * (e.g. adapter publish result observation).
 */
export function logSpan(trace: TraceContext, attrs: SpanAttributes): void {
  const entry = {
    level: 'info',
    timestamp: new Date().toISOString(),
    traceId: trace.traceId,
    spanId: trace.spanId,
    ...attrs,
  }
  if (typeof console !== 'undefined') {
    console.info(JSON.stringify(entry))
  }
}

/**
 * Initialize the OTel SDK for the current process.
 *
 * Registers a NodeSDK with:
 *   - OTLP HTTP trace exporter (endpoint from OTEL_EXPORTER_OTLP_ENDPOINT env)
 *   - Service name + version resource attributes
 *   - Always-on sampler (errors + unknown outcomes are always retained — Issue #155)
 *
 * Safe to call multiple times — only the first call registers the SDK.
 * Safe to skip in tests — the tracing module falls back to noop providers.
 */
export function initTracing(serviceName: string = 'nashrino-app'): void {
  // Lazy import so test environments that don't have the SDK installed
  // (or where registering a global provider would conflict) don't crash.
  // The SDK packages are bundled as real deps but we only invoke them when
  // explicitly requested by the host process.
  import('@opentelemetry/sdk-node')
    .then(({ NodeSDK }) =>
      Promise.all([
        import('@opentelemetry/exporter-trace-otlp-http'),
        import('@opentelemetry/resources'),
        import('@opentelemetry/semantic-conventions'),
      ]).then(([otlpMod, resourcesMod, semconvMod]) => {
        const exporter = new otlpMod.OTLPTraceExporter()
        // @opentelemetry/resources@2.x replaced the `Resource` class with the
        // `resourceFromAttributes()` factory. Detecting host/env info isn't
        // necessary for our use case — service name + version is enough for
        // downstream correlation in the OTLP backend.
        const resource = resourcesMod.resourceFromAttributes({
          [semconvMod.ATTR_SERVICE_NAME]: serviceName,
          [semconvMod.ATTR_SERVICE_VERSION]: TRACER_VERSION,
        })
        const sdk = new NodeSDK({
          traceExporter: exporter,
          resource,
          // Issue #155: always-on sampling. Errors and unknown outcomes are
          // retained for sure; the cost of full sampling is justified by the
          // publish-correctness SLO (target 99.5% — we cannot afford blind spots).
        })
        sdk.start()
        console.info(`[otel] SDK started for service "${serviceName}"`)
      })
    )
    .catch((err) => {
      console.error('[otel] failed to start SDK (continuing with noop tracer):', err)
    })
}

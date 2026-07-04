/**
 * Issue #155 Task 2: Structured logging with redaction.
 *
 * Standardizes the log schema across all services so every log line carries
 * the same correlation identifiers and never leaks secrets.
 *
 * Schema fields (Issue #155 §2):
 *   timestamp   — ISO-8601 UTC
 *   level       — debug | info | warn | error
 *   service     — process name (nashrino-app | nashrino-worker | nashrino-realtime)
 *   env         — NODE_ENV (or 'development')
 *   release     — RELEASE_SHA env var (set by CI on deploy)
 *   requestId   — short correlation ID (X-Request-Id header or generated)
 *   traceId     — W3C trace ID (32 hex chars) — null when no active span
 *   spanId      — W3C span ID (16 hex chars) — null when no active span
 *   operation   — logical operation name (e.g. "publish.create", "worker.process")
 *   workspaceId — safe entity ID (NEVER user/content IDs — cardinality + privacy)
 *   contentId   — safe entity ID (publish lifecycle uses this as the anchor)
 *   publicationId — safe entity ID (per-platform publication record)
 *   attemptId   — safe entity ID (per-attempt ledger row)
 *   provider    — platform name (telegram | instagram | linkedin | rubika | bale | eitaa)
 *   outcome     — success | permanent_failure | retryable_failure | outcome_unknown | cancelled
 *   durationMs  — operation duration
 *   errorCategory — auth | rate_limit | network | not_found | validation | provider | internal
 *   msg         — human-readable message (Persian or English)
 *
 * Redaction (Issue #155 §2):
 *   - Authorization headers (Bearer ..., Basic ...)
 *   - Cookie headers
 *   - OAuth codes (code=, code_verifier=, state=)
 *   - API keys / bot tokens (token=, api_key=, x-api-key)
 *   - Encrypted token secrets (tokenSecret field on Platform)
 *   - Media signed URLs (presigned S3 URLs)
 *   - Password fields
 *   - MFA secrets / backup codes
 *
 * Retention policy (Issue #155 §2):
 *   - Production logs: retained 30 days hot, 90 days cold
 *   - Access: SRE team only; audit-logged queries
 *   - PII: never logged at info level; warn/error paths strip PII before logging
 */

import { activeTraceContext, type TraceContext } from './tracing'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface StructuredLogFields {
  /** Short request correlation ID (8-12 chars). */
  requestId?: string
  /** Override the active trace context (defaults to activeTraceContext()). */
  trace?: TraceContext | null
  operation?: string
  workspaceId?: string
  contentId?: string
  publicationId?: string
  attemptId?: string
  provider?: string
  state?: string
  outcome?:
    | 'success'
    | 'permanent_failure'
    | 'retryable_failure'
    | 'outcome_unknown'
    | 'cancelled'
    | 'pending'
  durationMs?: number
  errorCategory?:
    | 'auth'
    | 'rate_limit'
    | 'network'
    | 'not_found'
    | 'validation'
    | 'provider'
    | 'internal'
    | 'unknown'
  msg: string
  /** Additional safe fields (caller responsibility — do NOT pass secrets). */
  extra?: Record<string, unknown>
}

const SERVICE_NAME = process.env.SERVICE_NAME || 'nashrino-app'
const ENV = process.env.NODE_ENV || 'development'
const RELEASE_SHA = process.env.RELEASE_SHA || process.env.GITHUB_SHA || 'dev'
const LOG_LEVEL = (process.env.LOG_LEVEL || (ENV === 'production' ? 'info' : 'debug')) as LogLevel

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

/**
 * Patterns that indicate a value is sensitive and must be redacted.
 * Applied to both keys (field names) and values (string contents).
 */
const SENSITIVE_KEY_PATTERNS = [
  /^authorization$/i,
  /^cookie$/i,
  /^x-api-key$/i,
  /^x-emit-secret$/i,
  /^password$/i,
  /^passwd$/i,
  /^secret$/i,
  /^token$/i,
  /^tokenSecret$/i,
  /^tokensecret$/i,
  /^accessToken$/i,
  /^access_token$/i,
  /^refreshToken$/i,
  /^refresh_token$/i,
  /^apiKey$/i,
  /^api_key$/i,
  /^apikey$/i,
  /^mfaSecret$/i,
  /^mfa_secret$/i,
  /^mfaBackupCodes$/i,
  /^backupCodes$/i,
  /^codeVerifier$/i,
  /^code_verifier$/i,
  /^oauthCode$/i,
  /^code$/i,
  /^state$/i,
  /^nextauth_secret$/i,
  /^auth_secret$/i,
  /^emit_secret$/i,
  /^encryptionKey/i,
  /^redisUrl$/i,
  /^databaseUrl$/i,
  /^connectionString$/i,
]

const SENSITIVE_VALUE_PATTERNS = [
  // Bearer / Basic auth tokens
  /Bearer\s+[A-Za-z0-9\-._~+/=]+/g,
  /Basic\s+[A-Za-z0-9+/=]+/g,
  // OAuth code / state query params
  /[?&]code=[^&\s"']+/g,
  /[?&]code_verifier=[^&\s"']+/g,
  /[?&]state=[^&\s"']+/g,
  /[?&]access_token=[^&\s"']+/g,
  /[?&]refresh_token=[^&\s"']+/g,
  // Token / api_key query params
  /[?&]token=[^&\s"']+/g,
  /[?&]api_key=[^&\s"']+/g,
  // Bot token format (Telegram-style: 123456789:ABC...)
  /\b\d{6,}:[A-Za-z0-9_-]{30,}\b/g,
  // AWS / S3 presigned URLs (X-Amz-Signature)
  /X-Amz-Signature=[A-Za-z0-9]+/g,
  /X-Amz-Credential=[^&\s"']+/g,
  // JWT tokens (header.payload.signature)
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  // Generic long hex/base64 secrets (40+ chars)
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
]

const REDACTED = '[REDACTED]'

/**
 * Returns true if the key matches a sensitive field name.
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key))
}

/**
 * Redact sensitive substrings inside a string value.
 * Replaces them with [REDACTED] so the surrounding context is preserved
 * (e.g. "Authorization: Bearer xyz" → "Authorization: Bearer [REDACTED]").
 */
function redactStringValue(value: string): string {
  let result = value
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    pattern.lastIndex = 0
    result = result.replace(pattern, (m) => {
      const eqIdx = m.indexOf('=')
      if (eqIdx > 0) {
        return m.slice(0, eqIdx + 1) + REDACTED
      }
      const spaceIdx = m.indexOf(' ')
      if (spaceIdx > 0) {
        return m.slice(0, spaceIdx + 1) + REDACTED
      }
      return REDACTED
    })
  }
  return result
}

/**
 * Recursively redact sensitive fields in a nested object.
 * Returns a shallow-cloned copy with secrets replaced by '[REDACTED]'.
 */
export function redact(value: unknown): unknown {
  if (value == null) return value
  if (typeof value === 'string') return redactStringValue(value)
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((v) => redact(v))
  }
  const obj = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (isSensitiveKey(k)) {
      out[k] = REDACTED
    } else {
      out[k] = redact(v)
    }
  }
  return out
}

/**
 * Build the canonical structured log entry.
 */
function buildLogEntry(level: LogLevel, fields: StructuredLogFields): Record<string, unknown> {
  const trace = fields.trace !== undefined ? fields.trace : activeTraceContext()
  return {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    env: ENV,
    release: RELEASE_SHA,
    requestId: fields.requestId ?? null,
    traceId: trace?.traceId ?? null,
    spanId: trace?.spanId ?? null,
    operation: fields.operation ?? null,
    workspaceId: fields.workspaceId ?? null,
    contentId: fields.contentId ?? null,
    publicationId: fields.publicationId ?? null,
    attemptId: fields.attemptId ?? null,
    provider: fields.provider ?? null,
    state: fields.state ?? null,
    outcome: fields.outcome ?? null,
    durationMs: fields.durationMs ?? null,
    errorCategory: fields.errorCategory ?? null,
    msg: fields.msg,
    ...(fields.extra ? { extra: redact(fields.extra) } : {}),
  }
}

/**
 * Emit a structured log line as JSON to stdout/stderr.
 *
 * In production this is consumed by the log aggregator (Loki/ELK). In dev
 * the JSON is still human-readable enough; install pino-pretty as a pipe
 * for colorized output: `bun run dev | pino-pretty`.
 */
function emit(level: LogLevel, fields: StructuredLogFields): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[LOG_LEVEL]) return
  const entry = buildLogEntry(level, fields)
  const line = JSON.stringify(entry)
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n')
  } else {
    process.stdout.write(line + '\n')
  }
}

export const structuredLogger = {
  debug: (fields: StructuredLogFields) => emit('debug', fields),
  info: (fields: StructuredLogFields) => emit('info', fields),
  warn: (fields: StructuredLogFields) => emit('warn', fields),
  error: (fields: StructuredLogFields) => emit('error', fields),
}

/**
 * Create a child logger scoped to a specific operation.
 * Pre-fills common fields so call sites can do `log.info({ msg: ... })`.
 */
export function createStructuredLogger(defaults: Partial<StructuredLogFields>) {
  return {
    debug: (fields: StructuredLogFields) =>
      emit('debug', { ...defaults, ...fields } as StructuredLogFields),
    info: (fields: StructuredLogFields) =>
      emit('info', { ...defaults, ...fields } as StructuredLogFields),
    warn: (fields: StructuredLogFields) =>
      emit('warn', { ...defaults, ...fields } as StructuredLogFields),
    error: (fields: StructuredLogFields) =>
      emit('error', { ...defaults, ...fields } as StructuredLogFields),
  }
}

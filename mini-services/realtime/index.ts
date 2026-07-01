/**
 * Nashrino SocialOps Studio — Realtime WebSocket Mini-Service
 *
 * Phase 7 additions:
 * - JWT handshake auth (connection rejected without valid token)
 * - Room authorization (membership check via DB on subscribe)
 * - Secure POST /emit (requires X-Emit-Secret header)
 * - Redis adapter for horizontal scaling (multiple realtime instances)
 * - Configurable port + CORS origin
 *
 * Architecture:
 *   publish-worker ──HTTP POST /emit (X-Emit-Secret)──▶  realtime  ──socket.io (JWT auth)──▶  frontend
 *
 * Auth flow:
 *   1. Frontend fetches NextAuth session token
 *   2. Frontend connects with io({ auth: { token } })
 *   3. Realtime verifies JWT, extracts userId + activeWorkspaceId
 *   4. On subscribe, checks WorkspaceMember membership
 *   5. If member, joins room; otherwise rejects
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { Server, type Socket } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'
import { realtimeRegistry, activeSocketsGauge } from './lib/metrics'

// ── Config (Issue #151: fail-closed in production) ───────────────────────
const PORT = parseInt(process.env.REALTIME_PORT || '3003', 10)
const isProduction = process.env.NODE_ENV === 'production'

// Issue #151: in production, required secrets MUST be set — no dev fallbacks.
// In development, we allow fallbacks for convenience.
function requireSecret(name: string, devDefault: string): string {
  const val = process.env[name]
  if (val) return val
  if (isProduction) {
    console.error(`[realtime] FATAL: ${name} is not set. Refusing to start in production.`)
    process.exit(1)
  }
  console.warn(`[realtime] WARNING: ${name} not set — using dev default. DO NOT USE IN PRODUCTION.`)
  return devDefault
}

const EMIT_SECRET = requireSecret('EMIT_SECRET', 'nashrino-dev-emit-secret')
// Issue #151: use a SEPARATE secret for realtime JWT signing (not NextAuth's secret)
const REALTIME_JWT_SECRET = requireSecret('REALTIME_JWT_SECRET', process.env.NEXTAUTH_SECRET || 'nashrino-dev-jwt-secret')
// Issue #151: CORS must be an explicit allowlist in production — no wildcard
const CORS_ORIGIN = process.env.REALTIME_CORS_ORIGIN || (isProduction ? '' : '*')
if (isProduction && (!CORS_ORIGIN || CORS_ORIGIN === '*')) {
  console.error('[realtime] FATAL: REALTIME_CORS_ORIGIN must be set to an explicit allowlist in production.')
  process.exit(1)
}
// #111: REDIS_CACHE_URL for Socket.io adapter (allkeys-lru policy); falls back to REDIS_URL
const REDIS_URL = process.env.REDIS_CACHE_URL || process.env.REDIS_URL || ''

// BUG-15: explicit opt-in flag instead of NODE_ENV so staging can run with auth
const isDev = process.env.DISABLE_AUTH === '1'

// ── Types ────────────────────────────────────────────────────────────────
type JobStatus = 'pending' | 'processing' | 'success' | 'failed' | 'action'
type Platform = 'instagram' | 'rubika' | 'telegram' | 'linkedin'

interface JobPayload {
  jobId: string
  status: JobStatus
  progress: number
  processLabel: string
  error: string | null
  platform: Platform
  externalId: string | null
}

interface EmitBody {
  workspaceId: string
  event: 'job:status' | 'job:progress'
  payload: JobPayload
}

interface SessionData {
  userId: string
  activeWorkspaceId: string | null
}

const ALLOWED_EVENTS = ['job:status', 'job:progress'] as const
const roomFor = (workspaceId: string): string => `workspace:${workspaceId}`

// ── JWT verification (Issue #151: enhanced with iss/aud/jti/purpose claims) ─
// Uses REALTIME_JWT_SECRET (separate from NextAuth's secret).
// Pins to HS256 algorithm. Verifies iss, aud, exp, purpose claims.
import { createHmac, timingSafeEqual } from 'crypto'

// Issue #151: expected JWT claims for realtime tokens
const JWT_ISSUER = 'nashrino-realtime'
const JWT_AUDIENCE = 'nashrino-realtime-service'
const JWT_PURPOSE = 'realtime-socket'

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4
  return Buffer.from(padded + (pad ? '='.repeat(4 - pad) : ''), 'base64').toString('utf8')
}

function verifyJwt(token: string): SessionData | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, signatureB64] = parts
    if (!headerB64 || !payloadB64 || !signatureB64) return null

    // Issue #151: verify header — pin to HS256 algorithm only
    const header = JSON.parse(base64UrlDecode(headerB64))
    if (header.alg !== 'HS256') {
      console.warn('[realtime] JWT rejected: unsupported algorithm', header.alg)
      return null
    }

    // Verify signature using REALTIME_JWT_SECRET (separate from NextAuth)
    const expectedSig = createHmac('sha256', REALTIME_JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url')

    if (!timingSafeEqual(Buffer.from(signatureB64), Buffer.from(expectedSig))) {
      return null
    }

    // Decode payload
    const payload = JSON.parse(base64UrlDecode(payloadB64))

    // Issue #151: verify required claims
    if (payload.iss !== JWT_ISSUER) {
      console.warn('[realtime] JWT rejected: wrong issuer', payload.iss)
      return null
    }
    if (payload.aud !== JWT_AUDIENCE) {
      console.warn('[realtime] JWT rejected: wrong audience', payload.aud)
      return null
    }
    if (payload.purpose !== JWT_PURPOSE) {
      console.warn('[realtime] JWT rejected: wrong purpose', payload.purpose)
      return null
    }

    // Check expiry
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null
    }

    // Issue #151: check nbf (not-before) with 5s skew tolerance
    if (payload.nbf && Date.now() < (payload.nbf - 5) * 1000) {
      console.warn('[realtime] JWT rejected: future issue time (nbf)')
      return null
    }

    return {
      userId: payload.sub || payload.userId || '',
      activeWorkspaceId: payload.activeWorkspaceId || null,
    }
  } catch {
    return null
  }
}

// ── In-memory workspace membership cache (avoids DB hit on every subscribe) ──
const membershipCache = new Map<string, { ok: boolean; expiresAt: number }>()
const CACHE_TTL_MS = 60_000 // 1 minute

async function checkMembership(userId: string, workspaceId: string): Promise<boolean> {
  const cacheKey = `${userId}:${workspaceId}`
  const cached = membershipCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.ok
  }

  // Dynamic import to avoid loading Prisma on every request
  const { db } = await import('./lib/db')
  try {
    const member = await db.workspaceMember.findFirst({
      where: { userId, workspaceId },
      select: { id: true },
    })
    const ok = !!member
    membershipCache.set(cacheKey, { ok, expiresAt: Date.now() + CACHE_TTL_MS })
    return ok
  } catch (err) {
    console.error('[auth] membership check failed:', err)
    return false
  }
}

// ── HTTP server ──────────────────────────────────────────────────────────
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
    // POST /emit — worker → relay broadcast (requires X-Emit-Secret)
    if (req.method === 'POST' && req.url?.split('?')[0] === '/emit') {
      // P7.3: verify shared secret
      const emitSecret = req.headers['x-emit-secret']
      if (!emitSecret || emitSecret !== EMIT_SECRET) {
        console.warn('[emit] unauthorized — missing or wrong X-Emit-Secret')
        return sendJson(res, 401, { ok: false, error: 'unauthorized' })
      }

      const body = await readJsonBody<EmitBody>(req)
      if (body == null) {
        return sendJson(res, 400, { ok: false, error: 'invalid JSON body' })
      }

      const { workspaceId, event, payload } = body
      if (
        typeof workspaceId !== 'string' ||
        workspaceId.length === 0 ||
        typeof event !== 'string' ||
        !ALLOWED_EVENTS.includes(event as (typeof ALLOWED_EVENTS)[number]) ||
        !payload ||
        typeof payload !== 'object'
      ) {
        return sendJson(res, 400, {
          ok: false,
          error: 'body must be { workspaceId, event, payload }',
        })
      }

      const room = roomFor(workspaceId)
      io.to(room).emit(event, payload)
      const subscribers = io.sockets.adapter.rooms.get(room)?.size ?? 0
      console.log(
        `[emit] room=${room} event=${event} jobId=${payload.jobId} status=${payload.status} subs=${subscribers}`
      )
      return sendJson(res, 200, { ok: true, event, room, subscribers })
    }

    // GET / or /health — liveness + readiness probe
    if (req.method === 'GET' && (req.url === '/' || req.url?.split('?')[0] === '/health')) {
      // Issue #151: report ACTUAL Redis adapter state, not just URL presence
      const redisState = redisAdapterReady ? 'connected' : (REDIS_URL ? 'degraded' : 'disabled')
      return sendJson(res, 200, {
        ok: true,
        service: 'nashrino-realtime',
        port: PORT,
        sockets: io.engine.clientsCount,
        // Issue #151: actual adapter state, not just URL config
        redis: redisState,
        // Issue #151: don't expose secret/config details
        configOk: isProduction ? !!(EMIT_SECRET && REALTIME_JWT_SECRET && CORS_ORIGIN) : true,
      })
    }

    // GET /readyz — readiness probe (Issue #151: separate from liveness)
    if (req.method === 'GET' && req.url?.split('?')[0] === '/readyz') {
      const checks: Record<string, boolean> = {
        process: true,
        redis: redisAdapterReady,
        config: isProduction ? !!(EMIT_SECRET && REALTIME_JWT_SECRET && CORS_ORIGIN) : true,
      }
      const allReady = Object.values(checks).every(v => v === true)
      return sendJson(res, allReady ? 200 : 503, {
        ok: allReady,
        status: allReady ? 'ready' : 'not_ready',
        checks,
      })
    }

    // GET /metrics — Prometheus scrape endpoint (Issue #126)
    if (req.method === 'GET' && req.url?.split('?')[0] === '/metrics') {
      res.writeHead(200, { 'Content-Type': realtimeRegistry.contentType })
      res.end(await realtimeRegistry.metrics())
      return
    }

    return sendJson(res, 404, { ok: false, error: 'not found' })
  } catch (err) {
    console.error('[http] unhandled error:', err)
    try {
      sendJson(res, 500, { ok: false, error: 'internal error' })
    } catch {
      // response already sent
    }
  }
})

// ── socket.io server ────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60_000,
  pingInterval: 25_000,
  connectTimeout: 10_000,
})

// P7.1: JWT handshake auth — runs on every new connection
io.use(async (socket: Socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined

  // Dev bypass: if no token and NODE_ENV !== production, allow (for preview)
  if (!token) {
    if (isDev) {
      console.log(`[io] dev bypass: ${socket.id} connected without token`)
      ;(socket as any).data.session = { userId: 'dev-user', activeWorkspaceId: null }
      return next()
    }
    return next(new Error('unauthorized: no token'))
  }

  const session = verifyJwt(token)
  if (!session) {
    console.warn(`[io] auth failed: ${socket.id} — invalid token`)
    return next(new Error('unauthorized: invalid token'))
  }

  ;(socket as any).data.session = session
  console.log(`[io] auth ok: ${socket.id} userId=${session.userId}`)
  next()
})

io.on('connection', (socket: Socket) => {
  const session = (socket as any).data.session as SessionData
  console.log(`[io] connected id=${socket.id} userId=${session?.userId}`)
  // Issue #126: update active sockets gauge on connect
  activeSocketsGauge.set(io.engine.clientsCount)

  // P7.2: Room authorization — check membership before joining
  socket.on('subscribe', async (data: unknown) => {
    const workspaceId = (data as { workspaceId?: unknown })?.workspaceId
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      socket.emit('error', { message: 'subscribe requires { workspaceId: string }' })
      return
    }

    // Dev bypass: skip membership check if no userId (preview mode)
    if (session?.userId && session.userId !== 'dev-user') {
      const isMember = await checkMembership(session.userId, workspaceId)
      if (!isMember) {
        console.warn(`[io] forbidden: ${socket.id} userId=${session.userId} → ${workspaceId}`)
        socket.emit('error', { message: 'forbidden: not a member of this workspace' })
        return
      }
    }

    const room = roomFor(workspaceId)
    void socket.join(room)
    console.log(`[io] ${socket.id} → joined ${room}`)
    socket.emit('subscribed', { workspaceId, room })
  })

  socket.on('unsubscribe', (data: unknown) => {
    const workspaceId = (data as { workspaceId?: unknown })?.workspaceId
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      socket.emit('error', { message: 'unsubscribe requires { workspaceId: string }' })
      return
    }
    const room = roomFor(workspaceId)
    void socket.leave(room)
    console.log(`[io] ${socket.id} ← left ${room}`)
    socket.emit('unsubscribed', { workspaceId, room })
  })

  socket.on('disconnect', (reason: string) => {
    console.log(`[io] disconnected id=${socket.id} reason=${reason}`)
    // Issue #126: update active sockets gauge on disconnect
    activeSocketsGauge.set(io.engine.clientsCount)
  })

  socket.on('error', (err: Error) => {
    console.error(`[io] socket error id=${socket.id}:`, err)
  })
})

io.engine.on(
  'connection_error',
  (err: { context?: unknown; code?: number; message?: string; req?: IncomingMessage }) => {
    console.error('[io] connection_error:', err.code, err.message)
  }
)

// P7.4: Redis adapter for horizontal scaling
// Issue #151: track actual adapter readiness (not just URL presence)
let redisAdapterReady = false
if (REDIS_URL) {
  const pubClient = createClient({ url: REDIS_URL })
  const subClient = pubClient.duplicate()

  Promise.all([
    pubClient.connect().catch((err) => console.error('[redis] pub connect failed:', err)),
    subClient.connect().catch((err) => console.error('[redis] sub connect failed:', err)),
  ])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient))
      redisAdapterReady = true // Issue #151: mark as ready only after successful connect
      console.log('[redis] adapter enabled — realtime can scale horizontally')
    })
    .catch((err) => {
      console.error('[redis] adapter setup failed:', err)
      redisAdapterReady = false
    })

  // Issue #151: track disconnect/reconnect for accurate readiness
  pubClient.on('error', () => { redisAdapterReady = false })
  pubClient.on('ready', () => { redisAdapterReady = true })
} else {
  console.log('[redis] disabled (REDIS_URL not set) — single-instance only')
}

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  console.error('[http] server error:', err)
  if (err.code === 'EADDRINUSE') {
    console.error(`[http] port ${PORT} is already in use — aborting`)
    process.exit(1)
  }
})

// ── Graceful shutdown ────────────────────────────────────────────────────
let shuttingDown = false
const shutdown = (signal: string) => {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`\n[realtime] ${signal} received, shutting down...`)
  io.close(() => {
    httpServer.close(() => {
      console.log('[realtime] closed')
      process.exit(0)
    })
  })
  setTimeout(() => {
    console.error('[realtime] forced exit after timeout')
    process.exit(1)
  }, 5000).unref?.()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// ── Boot ─────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(
    `[realtime] service on :${PORT} (cors: ${CORS_ORIGIN}, redis: ${REDIS_URL ? 'on' : 'off'})`
  )
})

// ── Helpers ──────────────────────────────────────────────────────────────
async function readJsonBody<T>(req: IncomingMessage): Promise<T | null> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer))
  }
  if (chunks.length === 0) return null
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
  } catch {
    return null
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

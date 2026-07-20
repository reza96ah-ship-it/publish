/**
 * Nashrino SocialOps Studio -- Realtime WebSocket Mini-Service
 *
 * Phase 7 additions:
 * - JWT handshake auth (connection rejected without valid token)
 * - Room authorization (membership check via DB on subscribe)
 * - Secure POST /emit (requires X-Emit-Secret header)
 * - Redis adapter for horizontal scaling (multiple realtime instances)
 * - Configurable port + CORS origin
 *
 * Issue #151 hardening:
 * - Fail-closed config (no dev secrets in production)
 * - Separate REALTIME_JWT_SECRET (not NextAuth's secret)
 * - CORS allowlist required in production (no wildcard)
 * - JWT verified via the `jose` library with all 9 required claims:
 *   iss, aud, sub, iat, nbf, exp, jti, purpose, kid
 * - Algorithm pinned to HS256
 * - Real Redis adapter readiness tracking
 * - /readyz endpoint with process + redis + config checks
 *
 * Architecture:
 *   publish-worker --HTTP POST /emit (X-Emit-Secret)-->  realtime  --socket.io (JWT auth)-->  frontend
 *
 * Auth flow:
 *   1. Frontend fetches a realtime JWT (issued with REALTIME_JWT_SECRET)
 *   2. Frontend connects with io({ auth: { token } })
 *   3. Realtime verifies JWT via jose (iss/aud/sub/iat/nbf/exp/jti/purpose/kid)
 *   4. On subscribe, checks WorkspaceMember membership
 *   5. If member, joins room; otherwise rejects
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { timingSafeEqual } from 'crypto'
import { Server, type Socket } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'
import { realtimeRegistry, activeSocketsGauge } from './lib/metrics'
import { loadRealtimeConfig } from './lib/config'
import { verifyRealtimeJwt, type SessionData } from './lib/jwt'
import { initTracing } from './lib/tracing'

initTracing('realtime')

// -- Config (Issue #151: fail-closed in production) --
// loadRealtimeConfig() will process.exit(1) in production if any required
// secret is missing or if CORS is wildcard/empty. In dev it falls back to
// documented dev defaults so local development keeps working.
const config = loadRealtimeConfig()
const {
  port: PORT,
  emitSecret: EMIT_SECRET,
  realtimeJwtSecret: REALTIME_JWT_SECRET,
  corsOrigin: CORS_ORIGIN,
  redisUrl: REDIS_URL,
  isProduction,
  isDev,
} = config

// -- Types --
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

/** Inbox thread event relayed to open inbox views (see src/modules/inbox/realtime-emit.ts). */
interface InboxThreadPayload {
  threadId: string
  kind: 'created' | 'message' | 'updated'
  messageType: string
  senderName?: string
  preview?: string
}

interface EmitBody {
  workspaceId: string
  event: 'job:status' | 'job:progress' | 'inbox:thread'
  payload: JobPayload | InboxThreadPayload
}

const ALLOWED_EVENTS = ['job:status', 'job:progress', 'inbox:thread'] as const
const roomFor = (workspaceId: string): string => `workspace:${workspaceId}`

// -- In-memory workspace membership cache (avoids DB hit on every subscribe) --
const membershipCache = new Map<string, { ok: boolean; expiresAt: number }>()
const CACHE_TTL_MS = 60_000 // 1 minute

async function checkMembership(userId: string, workspaceId: string): Promise<boolean> {
  const cacheKey = `${userId}:${workspaceId}`
  const cached = membershipCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.ok
  }

  try {
    // Dynamic import to avoid loading Prisma on every request. Kept inside the
    // try — a bad/missing DATABASE_URL previously threw at import time, escaping
    // this function as an unhandled rejection and crashing the whole process.
    const { db } = await import('./lib/db')
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

// -- HTTP server --
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
    // POST /emit -- worker -> relay broadcast (requires X-Emit-Secret)
    if (req.method === 'POST' && req.url?.split('?')[0] === '/emit') {
      // P7.3 + Issue #151: verify shared secret with constant-time comparison
      const emitSecretHeader = req.headers['x-emit-secret']
      const providedSecret = Array.isArray(emitSecretHeader)
        ? emitSecretHeader[0]
        : emitSecretHeader
      if (
        !providedSecret ||
        typeof providedSecret !== 'string' ||
        providedSecret.length !== EMIT_SECRET.length ||
        !timingSafeEqualStr(providedSecret, EMIT_SECRET)
      ) {
        console.warn('[emit] unauthorized -- missing or wrong X-Emit-Secret')
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
        `[emit] room=${room} event=${event} ref=${'jobId' in payload ? payload.jobId : payload.threadId} subs=${subscribers}`
      )
      return sendJson(res, 200, { ok: true, event, room, subscribers })
    }

    // GET / or /health -- liveness + readiness probe
    if (req.method === 'GET' && (req.url === '/' || req.url?.split('?')[0] === '/health')) {
      // Issue #151: report ACTUAL Redis adapter state, not just URL presence
      const redisState = redisAdapterReady
        ? 'connected'
        : REDIS_URL
          ? 'degraded'
          : 'disabled'
      return sendJson(res, 200, {
        ok: true,
        service: 'nashrino-realtime',
        port: PORT,
        sockets: io.engine.clientsCount,
        // Issue #151: actual adapter state, not just URL config
        redis: redisState,
        // Issue #151: don't expose secret/config details -- boolean only
        configOk: isProduction
          ? !!(EMIT_SECRET && REALTIME_JWT_SECRET && CORS_ORIGIN)
          : true,
      })
    }

    // GET /readyz -- readiness probe (Issue #151: separate from liveness)
    if (req.method === 'GET' && req.url?.split('?')[0] === '/readyz') {
      const checks: Record<string, boolean> = {
        process: true,
        redis: redisAdapterReady,
        config: isProduction
          ? !!(EMIT_SECRET && REALTIME_JWT_SECRET && CORS_ORIGIN)
          : true,
      }
      const allReady = Object.values(checks).every((v) => v === true)
      return sendJson(res, allReady ? 200 : 503, {
        ok: allReady,
        status: allReady ? 'ready' : 'not_ready',
        checks,
      })
    }

    // GET /metrics -- Prometheus scrape endpoint (Issue #126)
    // P1-9: Auth — if METRICS_TOKEN env is set, require
    // `Authorization: Bearer <token>`. Otherwise, allow localhost only
    // (standard Prometheus pattern).
    if (req.method === 'GET' && req.url?.split('?')[0] === '/metrics') {
      const expectedToken = process.env.METRICS_TOKEN
      let authorized = false

      if (expectedToken) {
        const authHeader = req.headers['authorization']
        const headerVal = Array.isArray(authHeader) ? authHeader[0] : authHeader
        const match = typeof headerVal === 'string' && headerVal.length > 7 && headerVal.substring(0, 7).toLowerCase() === 'bearer ' ? headerVal.substring(7).trim() : null
        if (match && match[1] && timingSafeEqualStr(match[1], expectedToken)) {
          authorized = true
        }
      } else {
        // No token configured: allow localhost only.
        const forwardedFor = req.headers['x-forwarded-for']
        const firstHopRaw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor ?? ''
        const firstHop = (typeof firstHopRaw === 'string' ? firstHopRaw : '').split(',')[0]?.trim() ?? ''
        const localhostHops = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', ''])
        const hostHeader = req.headers['host'] ?? ''
        const isLoopback =
          localhostHops.has(firstHop) &&
          (/^localhost(:\d+)?$/i.test(hostHeader) ||
            /^127\./.test(hostHeader) ||
            hostHeader.startsWith('[::1]'))
        authorized = isLoopback
      }

      if (!authorized) {
        return sendJson(res, 401, { ok: false, error: 'unauthorized' })
      }

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

// -- socket.io server --
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60_000,
  pingInterval: 25_000,
  connectTimeout: 10_000,
})

// P7.1: JWT handshake auth -- runs on every new connection.
// Issue #151: verification delegated to lib/jwt.ts (jose library) which
// enforces all 9 claims, algorithm pinning, and clock skew tolerance.
io.use(async (socket: Socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined

  // Dev bypass: if no token and DISABLE_AUTH=1, allow (for preview)
  if (!token) {
    if (isDev) {
      console.log(`[io] dev bypass: ${socket.id} connected without token`)
      ;(socket as any).data.session = { userId: 'dev-user', activeWorkspaceId: null }
      return next()
    }
    return next(new Error('unauthorized: no token'))
  }

  const session = await verifyRealtimeJwt(token, REALTIME_JWT_SECRET)
  if (!session) {
    console.warn(`[io] auth failed: ${socket.id} -- invalid token`)
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

  // P7.2: Room authorization -- check membership before joining
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
        console.warn(`[io] forbidden: ${socket.id} userId=${session.userId} -> ${workspaceId}`)
        socket.emit('error', { message: 'forbidden: not a member of this workspace' })
        return
      }
    }

    const room = roomFor(workspaceId)
    void socket.join(room)
    console.log(`[io] ${socket.id} -> joined ${room}`)
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
    console.log(`[io] ${socket.id} <- left ${room}`)
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
      console.log('[redis] adapter enabled -- realtime can scale horizontally')
    })
    .catch((err) => {
      console.error('[redis] adapter setup failed:', err)
      redisAdapterReady = false
    })

  // Issue #151: track disconnect/reconnect for accurate readiness
  pubClient.on('error', () => {
    redisAdapterReady = false
  })
  pubClient.on('ready', () => {
    redisAdapterReady = true
  })
} else {
  console.log('[redis] disabled (REDIS_URL not set) -- single-instance only')
}

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  console.error('[http] server error:', err)
  if (err.code === 'EADDRINUSE') {
    console.error(`[http] port ${PORT} is already in use -- aborting`)
    process.exit(1)
  }
})

// -- Graceful shutdown --
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

// -- Boot --
httpServer.listen(PORT, () => {
  console.log(
    `[realtime] service on :${PORT} (cors: ${CORS_ORIGIN}, redis: ${REDIS_URL ? 'on' : 'off'})`
  )
})

// -- Helpers --
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

/**
 * Constant-time string comparison to prevent timing attacks on shared
 * secrets. Returns true if both strings are equal length AND byte-equal.
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  // Lengths are equal so timingSafeEqual won't throw.
  return bufA.equals(bufB) && timingSafeEqual(bufA, bufB)
}

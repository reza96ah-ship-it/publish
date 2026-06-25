/**
 * Nashrino SocialOps Studio — Realtime WebSocket Mini-Service (P1-2)
 *
 * A socket.io relay that broadcasts publish-job status changes from the
 * publish-worker to subscribed frontend clients.
 *
 * Architecture:
 *   publish-worker  ──HTTP POST /emit──▶  realtime (this)  ──socket.io──▶  frontend
 *
 * Room model:
 *   Each workspace gets a room named `workspace:{workspaceId}`. The frontend
 *   subscribes to its workspace room on connect; the worker broadcasts to
 *   that room by POSTing to /emit.
 *
 * Port: 3003 (hardcoded — do NOT use env PORT; the Caddyfile routes
 * `?XTransformPort=3003` here).
 *
 * Path: socket.io default (`/socket.io/`) — the frontend connects with
 *   `io("/?XTransformPort=3003")` and Caddy's `@transform_port_query`
 *   matcher forwards the request to localhost:3003.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { Server, type Socket } from 'socket.io'

// ── Config ───────────────────────────────────────────────────────────────
const PORT = 3003

// ── Types ────────────────────────────────────────────────────────────────
type JobStatus = 'pending' | 'processing' | 'success' | 'failed' | 'action'
type Platform = 'instagram' | 'rubika' | 'telegram' | 'linkedin'

/** Wire shape for `job:status` and `job:progress` events. */
interface JobPayload {
  jobId: string
  status: JobStatus
  progress: number // 0-100
  processLabel: string
  error: string | null
  platform: Platform
  externalId: string | null
}

/** Body for `POST /emit`, called by the publish-worker. */
interface EmitBody {
  workspaceId: string
  event: 'job:status' | 'job:progress'
  payload: JobPayload
}

const ALLOWED_EVENTS = ['job:status', 'job:progress'] as const
const roomFor = (workspaceId: string): string => `workspace:${workspaceId}`

// ── HTTP server (carries POST /emit + health; socket.io rides on top) ─────
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
    // POST /emit — worker → relay broadcast
    if (req.method === 'POST' && req.url?.split('?')[0] === '/emit') {
      const body = await readJsonBody<EmitBody>(req)
      if (body == null) {
        return sendJson(res, 400, { ok: false, error: 'invalid JSON body' })
      }

      const { workspaceId, event, payload } = body
      if (
        typeof workspaceId !== 'string' || workspaceId.length === 0 ||
        typeof event !== 'string' ||
        !ALLOWED_EVENTS.includes(event as (typeof ALLOWED_EVENTS)[number]) ||
        !payload || typeof payload !== 'object'
      ) {
        return sendJson(res, 400, {
          ok: false,
          error: 'body must be { workspaceId: string, event: "job:status"|"job:progress", payload: JobPayload }',
        })
      }

      const room = roomFor(workspaceId)
      io.to(room).emit(event, payload)
      const subscribers = io.sockets.adapter.rooms.get(room)?.size ?? 0
      console.log(
        `[emit] room=${room} event=${event} jobId=${payload.jobId} status=${payload.status} subs=${subscribers}`,
      )
      return sendJson(res, 200, { ok: true, event, room, subscribers })
    }

    // GET / or /health — lightweight liveness probe
    if (req.method === 'GET' && (req.url === '/' || req.url?.split('?')[0] === '/health')) {
      return sendJson(res, 200, {
        ok: true,
        service: 'nashrino-realtime',
        port: PORT,
        sockets: io.engine.clientsCount,
      })
    }

    // Everything that's NOT a socket.io request gets a clean 404.
    // (socket.io attaches its own request listener and intercepts /socket.io/* paths
    // before this handler runs, so we only see non-socket.io traffic here.)
    return sendJson(res, 404, { ok: false, error: 'not found' })
  } catch (err) {
    console.error('[http] unhandled error:', err)
    try {
      sendJson(res, 500, { ok: false, error: 'internal error' })
    } catch {
      // response already sent — ignore
    }
  }
})

// ── socket.io server ─────────────────────────────────────────────────────
const io = new Server(httpServer, {
  // Default path (`/socket.io/`) — the frontend connects with
  // `io("/?XTransformPort=3003")` and Caddy forwards based on the query param.
  cors: {
    origin: '*', // frontend on :3000, Caddy on :81
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60_000,
  pingInterval: 25_000,
  connectTimeout: 10_000,
})

io.on('connection', (socket: Socket) => {
  console.log(`[io] connected id=${socket.id}`)

  socket.on('subscribe', (data: unknown) => {
    const workspaceId = (data as { workspaceId?: unknown })?.workspaceId
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      socket.emit('error', { message: 'subscribe requires { workspaceId: string }' })
      return
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
  })

  socket.on('error', (err: Error) => {
    console.error(`[io] socket error id=${socket.id}:`, err)
  })
})

io.engine.on('connection_error', (err: { context?: unknown; code?: number; message?: string; req?: IncomingMessage }) => {
  console.error('[io] connection_error:', err.code, err.message, err.context?.toString?.() ?? '')
})

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
  // Stop accepting new connections, then close existing ones.
  io.close(() => {
    httpServer.close(() => {
      console.log('[realtime] closed')
      process.exit(0)
    })
  })
  // Hard-exit fallback in case something hangs.
  setTimeout(() => {
    console.error('[realtime] forced exit after timeout')
    process.exit(1)
  }, 5000).unref?.()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// ── Boot ─────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(` realtime service on :${PORT}`)
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

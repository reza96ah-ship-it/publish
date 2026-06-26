# Decision Log — Nashrino

**Last updated:** 2025-06-26

A record of significant architecture and engineering decisions. Each entry should explain **why** the decision was made, not just **what** was decided.

---

## D-001: Harden, don't rewrite

**Date:** 2025-06-26
**Status:** Accepted
**Context:** The `publish` repo scores 2/10 on production readiness. 5 blocking security issues exist (disabled middleware, demo-mode fallback, plaintext tokens, `ignoreBuildErrors: true`, CSP `frame-ancestors *`). However, the foundation is sound: real publish adapters, circuit breaker, scrypt hashing, RSC migration, Persian AI prompt engineering.
**Decision:** Harden the existing codebase in 10 phases over ~10 weeks, rather than rewriting from scratch. Each phase is independently shippable.
**Why:** A rewrite would discard the working publish pipeline, Persian AI quality, and Jalali calendar work. The blockers are fixable in ~1 week (Phase 1). The medium-term gaps (Docker, Postgres, CI) are additive, not structural.
**Alternatives considered:**
- Full rewrite in a new repo — rejected (discards 6 months of Persian AI tuning).
- Fork `rubika-publisher-mvp` and port UI — rejected (that repo has a different stack: FastAPI + Celery + Postgres; mixing would create a hybrid maintenance nightmare).
**Consequences:** 10 weeks of focused work. Each phase has acceptance criteria. No big-bang deploy.

---

## D-002: PostgreSQL over SQLite for production

**Date:** 2025-06-26
**Status:** Accepted (pending Phase 4 execution)
**Context:** SQLite is used currently. It's single-writer — under concurrent publishes + dashboard queries, it will hit `SQLITE_BUSY` errors. No migrations directory (`db:push` only). Can't evolve schema safely in production.
**Decision:** Migrate to PostgreSQL 16 in Phase 4. Use Prisma migrations (`prisma migrate`). Configure PgBouncer for connection pooling.
**Why:** PostgreSQL handles concurrent reads/writes, supports real migrations, and scales horizontally. PgBouncer pools connections (Prisma opens ~10-20 per instance; 3 instances = 60 connections; Postgres default max is 100). SQLite's WAL mode helps but doesn't solve the single-writer limit for the worker's UPDATE queries.
**Alternatives considered:**
- Stay on SQLite — rejected (can't scale beyond ~50 concurrent users).
- Use Turso (libSQL) — rejected (adds vendor lock-in; Postgres is more standard).
- Use MySQL — rejected (Postgres has better JSON support, which we need for `AuditLog.metadata`).
**Consequences:** Requires migration script (encrypt existing tokens first in Phase 5, then migrate). PgBouncer adds a service to `docker-compose.yml`. `DATABASE_URL` format changes.

---

## D-003: AES-256-GCM for platform token encryption

**Date:** 2025-06-26
**Status:** Accepted (pending Phase 5 execution)
**Context:** `Platform.tokenSecret` stores Telegram bot tokens and IG/LI OAuth tokens in plaintext. A DB dump leaks all connected accounts.
**Decision:** Encrypt tokens with AES-256-GCM using a key derived from `AUTH_SECRET` via `scryptSync`. Store as `iv:ciphertext:tag` string.
**Why:** AES-256-GCM is authenticated encryption (detects tampering). `scryptSync` is the same KDF used for passwords (consistency). Using `AUTH_SECRET` as the root key means rotating the secret re-encrypts all tokens (operational simplicity).
**Alternatives considered:**
- AWS KMS / HashiCorp Vault — rejected for now (adds infrastructure; revisit when we have >1000 workspaces).
- Application-level encryption with a separate `ENCRYPTION_KEY` — considered, but `AUTH_SECRET` is already required and rotated.
- Database-level encryption (Postgres `pgcrypto`) — rejected (couples encryption to DB; harder to migrate).
**Consequences:** Token read/write paths need `encrypt()`/`decrypt()` wrappers. Existing tokens need a one-time migration script. If `AUTH_SECRET` is rotated, all tokens must be re-encrypted.

---

## D-004: BullMQ over DB-polling for worker queue

**Date:** 2025-06-26
**Status:** Accepted (pending Phase 6 execution)
**Context:** Worker currently polls the DB every 2s for pending jobs. This works but has issues: 2s latency, no job prioritization, no dead-letter queue, no rate-limit-per-worker, no observability into queue depth.
**Decision:** Migrate to BullMQ (Redis-backed) in Phase 6. Worker becomes a BullMQ worker. DB remains source of truth; queue is just for dispatch.
**Why:** BullMQ provides: sub-second job dispatch, per-worker concurrency control, dead-letter queue, rate limiting, delayed jobs, job prioritization, observability (BullMQ dashboard). It also gives us graceful shutdown for free (BullMQ workers handle SIGTERM).
**Alternatives considered:**
- Stay on DB-polling — considered (simpler), but rejected (can't achieve <1s publish latency for "publish now" flow).
- Use Celery (Python) — rejected (we're a Node/Bun shop; adds a Python service).
- Use AWS SQS — rejected (vendor lock-in; BullMQ + Redis is self-hosted).
**Consequences:** Adds Redis as a hard dependency (already needed for rate limiting + socket.io adapter). Worker code changes from `while(true) poll` to `new Worker('publish-jobs', processJob)`. Need to handle the transition (drain old DB-polling jobs before switching).

---

## D-005: Redis adapter for socket.io horizontal scaling

**Date:** 2025-06-26
**Status:** Accepted (pending Phase 7 execution)
**Context:** Realtime service is single-process socket.io. Can't scale beyond one instance. If the realtime process crashes, all clients disconnect and must wait for reconnection to a new instance.
**Decision:** Add `@socket.io/redis-adapter` in Phase 7. Run multiple realtime instances behind a load balancer.
**Why:** Redis adapter broadcasts events across all socket.io instances. A client connected to instance A receives events published by the worker via instance B. Enables HA (if one instance dies, clients reconnect to another).
**Alternatives considered:**
- Use Pusher/Ably (managed WebSocket service) — rejected (cost; vendor lock-in).
- Use Server-Sent Events (SSE) instead — considered (simpler), but rejected (no bidirectional; can't do room subscription).
- Stay single-instance — rejected (no HA; can't scale).
**Consequences:** Adds Redis dependency (shared with BullMQ + rate limiter — same Redis instance). Need sticky sessions at the load balancer (socket.io falls back to long-polling on first connect).

---

## D-006: S3 presigned URLs for media upload

**Date:** 2025-06-26
**Status:** Accepted (pending Phase 9 execution)
**Context:** Media uploads go to local disk (`public/uploads/`). Doesn't scale beyond one server. Next.js body limit is 10MB. No CDN. No lifecycle policies.
**Decision:** Migrate to S3 (or S3-compatible: R2, MinIO) with presigned URLs in Phase 9. Client uploads directly to S3; server only issues presigned URLs and confirms uploads.
**Why:** Presigned URLs bypass the Next.js server (no body limit, no memory pressure). S3 provides: CDN (CloudFront), lifecycle policies (IA → Glacier), versioning, server-side encryption. Per-workspace quota is easy to enforce (check before presign).
**Alternatives considered:**
- Keep local disk + NFS — rejected (NFS is slow and fragile; no CDN).
- Use Cloudinary/imgix — considered (good for image transformations), but rejected (cost; vendor lock-in).
- Use Vercel Blob — rejected (we're not on Vercel; self-hosted).
**Consequences:** Adds S3 SDK dependency. `Media.url` points to CDN, not `/uploads/`. Need `POST /api/media/presign` + `POST /api/media/confirm` (replaces `POST /api/media/upload`). ClamAV scan happens on confirm (server downloads from S3, scans, deletes if infected).

---

## D-007: `requireWorkspaceApi()` over `getWorkspaceId()`

**Date:** 2025-06-26
**Status:** Accepted (pending Phase 1 execution)
**Context:** `getWorkspaceId()` in `src/lib/server.ts:25-31` falls back to the first workspace in the DB when no session exists. This is a multi-tenant isolation failure. `requireWorkspaceApi()` in `src/lib/auth-guards.ts:92-133` already exists and returns 401 JSON, but is used by 0/36 routes.
**Decision:** Migrate all 31 workspace-scoped routes from `getWorkspaceId()` to `requireWorkspaceApi()` in Phase 1.
**Why:** `requireWorkspaceApi()` returns 401 if no session, 403 if no `activeWorkspaceId`, 403 if no membership. It's the correct API-route guard. `getWorkspaceId()` was a demo-mode workaround that should never have shipped to production.
**Alternatives considered:**
- Keep `getWorkspaceId()` but remove the fallback — considered, but `requireWorkspaceApi()` is already better (returns proper HTTP status codes, includes role for RBAC).
**Consequences:** All 31 routes change from `const workspaceId = await getWorkspaceId(); if (!workspaceId) return 404` to `const guard = await requireWorkspaceApi(); if (guard.error) return guard.error; const { workspace } = guard;`. Mechanical find-replace. The frontend may see 401/403 where it previously saw 200 (demo-mode data) — need to verify the frontend handles auth redirects properly.

---

## D-008: Re-enable `ignoreBuildErrors: false`

**Date:** 2025-06-26
**Status:** Accepted (pending Phase 1 execution)
**Context:** `next.config.ts:5-7` sets `typescript.ignoreBuildErrors: true`. This ships 156 TypeScript errors (25 in `src/`). Type errors can cause runtime bugs that are hard to trace.
**Decision:** Set `ignoreBuildErrors: false` in Phase 1. Fix all 25 `src/` type errors.
**Why:** TypeScript is a safety net. Shipping with it disabled is like driving without a seatbelt. The 25 errors are mostly typing issues (not logic bugs) and are fixable in ~6 hours.
**Alternatives considered:**
- Keep `ignoreBuildErrors: true` and fix errors gradually — rejected (new errors will accumulate; no enforcement).
**Consequences:** `bun run build` will fail until all type errors are fixed. CI must run `bunx tsc --noEmit` to catch errors before build.

---

## How to add a new decision

1. Copy the template below.
2. Replace `{ID}`, `{Date}`, `{Context}`, `{Decision}`, `{Why}`, `{Alternatives}`, `{Consequences}`.
3. Append to this file.

```markdown
## D-{NNN}: {Title}

**Date:** {YYYY-MM-DD}
**Status:** {Proposed | Accepted | Deprecated | Superseded by D-{NNN}}
**Context:** {Why is this decision needed? What problem are we solving?}
**Decision:** {What did we decide?}
**Why:** {Why this option over alternatives?}
**Alternatives considered:**
- {Alternative 1} — {why rejected}
- {Alternative 2} — {why rejected}
**Consequences:** {What changes? What must be done?}
```

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

---

## D-009: Stable version baseline (not "newest experimental")

**Date:** 2025-06-26
**Status:** Accepted
**Context:** The codebase uses various versions, some outdated, some bleeding-edge. We need a pinned stable baseline for production reliability.
**Decision:** Pin to stable production releases as documented in `docs/VERSION_BASELINE_2026.md`. Specifically: Node.js 24.18 LTS (not Node 26 current), Next.js 16.2.9, React 19.2.7, TypeScript 6.0.3, Tailwind 4.3.1, Zod 4.4.3, NextAuth 4.24.14 (not Auth.js v5 beta), Prisma 7.8.0, PostgreSQL 18.4 (not 19 beta).
**Why:** Production systems run on stable LTS. "Newest" often means beta/unstable. Auth.js v5 is still beta-tagged in many flows — staying on NextAuth 4.24.14 is safer. PostgreSQL 19 is beta — 18.4 is the production stable.
**Alternatives considered:**

- Chase "latest" versions — rejected (beta bugs, breaking changes, no security backports).
- Stay on current versions (Next 16.1, Prisma 6.11) — acceptable for Phase 1, but upgrade to the baseline before Phase 4 (Postgres migration).
  **Consequences:** Prisma 6 → 7 is a major upgrade with breaking changes — do it alongside the Postgres migration (Phase 4). TypeScript 5 → 6 may surface new type errors — audit before upgrading.

---

## D-010: Modular monolith (not microservices, not flat template)

**Date:** 2025-06-26
**Status:** Accepted
**Context:** The current `src/app/api/` is a flat collection of 36 route handlers with business logic inline. This doesn't scale — routes become fat, logic is duplicated, tests are hard.
**Decision:** Refactor to a **modular monolith** with 11 domain modules (`src/modules/{name}/`). Each module has `service.ts` (business logic), `repository.ts` (Prisma queries), `types.ts` (types + Zod). API routes become thin: validate → authorize → call service → return.
**Why:** Modular monolith gives strong boundaries without the operational overhead of microservices. Single deploy unit, shared types, easy debugging. Can extract to microservices later if scale demands. The BFF pattern (thin routes → services) keeps route handlers under 20 lines.
**Alternatives considered:**

- Microservices (one service per domain) — rejected (premature; adds network latency, RPC schema drift, ops complexity).
- Keep flat structure — rejected (routes are already fat; duplication is growing).
- Next.js Server Actions only (no API routes) — considered (good for mutations), but we need API routes for webhooks, SSE, and external integrations.
  **Consequences:** Gradual migration (Phase 8-10). Extract modules one at a time, each in a separate PR. No big-bang rewrite. See `docs/ARCHITECTURE_MODULAR_MONOLITH.md` for the full plan.

---

## D-011: BullMQ for all background work

**Date:** 2025-06-26
**Status:** Accepted (supersedes D-004 details)
**Context:** The current worker DB-polls every 2s. This adds 2s latency, no prioritization, no dead-letter queue, no per-worker concurrency control, no observability.
**Decision:** Migrate all background work to BullMQ (Redis-backed). Six queues: `publish-jobs`, `media-processing`, `analytics-sync`, `webhook-process`, `notifications`, `automations`.
**Why:** BullMQ provides sub-second dispatch, per-queue concurrency, dead-letter queue, rate limiting, delayed jobs, prioritization, and a dashboard (`bullboard`). It also gives graceful shutdown for free. Any work that shouldn't block a page request (publishing, retries, media processing, IG automation, analytics sync, webhook processing, notifications) runs in a worker.
**Alternatives considered:**

- Stay on DB-polling — rejected (can't achieve <1s "publish now" latency).
- Use AWS SQS — rejected (vendor lock-in; BullMQ + Redis is self-hosted).
- Use Celery (Python) — rejected (we're TypeScript-native; adds a Python service).
  **Consequences:** Redis becomes a hard dependency (shared with rate limiter + socket.io adapter — same instance). Worker code changes from `while(true) poll` to `new Worker('queue', processor)`. Transition: drain old DB-polling jobs before switching.

---

## D-012: Instagram official Meta API only (no scraping)

**Date:** 2025-06-26
**Status:** Accepted
**Context:** Instagram publishing can be done via official Meta API (for Business/Creator accounts) or via unofficial scraping/automation (password login, unofficial DM). The latter violates Meta's terms and risks account bans.
**Decision:** Use **only** the official Meta Graph API for Instagram. OAuth flow, proper permissions, webhook handling, container-based publishing. Personal accounts get manual/reminder mode (no API publish). No scraping, no password login automation, no unofficial DM, no fake auto-publish claims.
**Why:** Official API is the only sustainable path. Scraping gets accounts banned. Official API supports: publishing (posts/reels), comment management, insights, comment-to-DM automation. Limitations (personal accounts, 24h window) are documented and handled with manual fallback.
**Alternatives considered:**

- Unofficial scraping — rejected (ToS violation, account bans, legal risk).
- Only support Business/Creator accounts (drop personal) — considered, but rejected (many Iranian users have personal accounts; manual mode is a valid fallback).
  **Consequences:** Must implement proper OAuth flow (Meta App Dashboard setup). Must subscribe to webhooks for comment automation. Must handle rate limits and the 24h messaging window. Personal accounts get a "manual publish" reminder UI.

---

## D-013: S3-compatible object storage (not local disk)

**Date:** 2025-06-26
**Status:** Accepted (reaffirms D-006 with S3-compatible specificity)
**Context:** Media currently uploads to `public/uploads/` (local disk). Doesn't scale, no CDN, no lifecycle policies, 10MB Next.js body limit.
**Decision:** Use S3-compatible object storage (AWS S3, Cloudflare R2, or self-hosted MinIO). Client uploads directly via presigned URL (bypasses Next.js server). CDN serves images from edge. Lifecycle policies: originals → IA after 30 days → Glacier after 90 days.
**Why:** Presigned URLs bypass the Next.js body limit and memory pressure. S3 provides CDN, versioning, server-side encryption, lifecycle policies. Per-workspace quota is easy to enforce (check before presign). R2 has zero egress fees (good for CDN).
**Alternatives considered:**

- Cloudinary/imgix — rejected (cost, vendor lock-in).
- Vercel Blob — rejected (we're self-hosted).
- Local disk + NFS — rejected (slow, fragile, no CDN).
  **Consequences:** Adds `@aws-sdk/client-s3` dependency. `Media.url` points to CDN. Need `POST /api/media/presign` + `POST /api/media/confirm` (replaces `POST /api/media/upload`). ClamAV scan happens on confirm.

---

## D-014: Token-driven UI system (design tokens)

**Date:** 2025-06-26
**Status:** Accepted
**Context:** The current UI uses ad-hoc Tailwind classes. Dark mode works but is not token-driven. RTL uses physical properties in some places. No high-contrast mode.
**Decision:** Implement a token-driven UI system via Tailwind 4 `@theme` directive. Tokens for: spacing (4px scale), radius, glass blur, shadows, buttons, tags, typography, RTL (logical properties), dark mode (CSS variables), high contrast (`prefers-contrast: high`).
**Why:** Tokens ensure consistency. Logical properties (`ms-2` not `ml-2`) are RTL-native. CSS variables enable dark mode + high contrast without recompilation. WCAG 2.2 AA minimum, AAA where possible.
**Alternatives considered:**

- Keep ad-hoc classes — rejected (inconsistency grows).
- Use a design-system library (Mantine, Chakra) — rejected (we're on shadcn/ui; adding another system creates conflict).
  **Consequences:** Refactor globals.css to use `@theme` with all tokens. Audit components for physical properties (`ml-`, `mr-`, `pl-`, `pr-`) → replace with logical (`ms-`, `me-`, `ps-`, `pe-`). Add `prefers-reduced-motion` and `prefers-contrast: high` media queries.

---

## D-015: Observability before launch (not after)

**Date:** 2025-06-26
**Status:** Accepted
**Context:** The current app has no structured logs, no metrics, no tracing, no error tracking, no `/api/health`. If something breaks in production, we're flying blind.
**Decision:** Add full observability in Phase 2 (before any production traffic): pino structured logs with request IDs, Sentry error tracking, Prometheus metrics endpoint, OpenTelemetry tracing, `/api/health` + `/api/readyz` endpoints, worker health endpoint, BullMQ dashboard.
**Why:** Without observability, mean-time-to-detect (MTTD) is hours (user reports "it's broken"). With observability, MTTD is minutes (Sentry alert). Structured logs with request IDs let you trace a single request across services. Metrics let you spot trends (publish success rate dropping). Tracing lets you find the slow span.
**Alternatives considered:**

- Add observability "after launch when we have traffic" — rejected (you can't debug what you can't see; first users will hit bugs you can't diagnose).
- Use only console.log + manual log review — rejected (doesn't scale, no search, no alerting).
  **Consequences:** Adds pino, @sentry/nextjs, prom-client, @opentelemetry/sdk-node dependencies. All `console.log` calls replaced with `logger.info` (pino). CI checks for structured log format.

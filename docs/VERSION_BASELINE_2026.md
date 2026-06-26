# Version Baseline 2026 — Nashrino

**Created:** 2025-06-26
**Principle:** Use stable production releases, not "newest experimental." Every version below is pinned to a stable LTS/production tag.

---

## Stable Version Pins

### Runtime & Frontend

| Layer | Recommended Stable | Notes |
|---|---|---|
| **Runtime** | Node.js 24.18.0 LTS | Production default. Node 26 is current but NOT prod-default yet. |
| **Package manager** | Bun 1.2.x | Used for dev speed; Node LTS for production container runtime. |
| **Frontend** | Next.js 16.2.9 | App Router, RSC, standalone output. |
| **UI lib** | React 19.2.7 | Concurrent features, use() hook. |
| **Language** | TypeScript 6.0.3 | Strict mode (`strict: true`, `noImplicitAny: true`). |
| **Styling** | Tailwind CSS 4.3.1 | CSS-first config, `@theme` directive. |
| **Components** | shadcn/ui (New York) | Radix primitives + Tailwind. |
| **Client data** | TanStack React Query 5.101.1 | Server state, cache, optimistic. |
| **Client state** | Zustand 5.x | UI-only state (activeView, modals). |
| **Validation** | Zod 4.4.3 | Input validation at every boundary. |
| **Motion** | Framer Motion 12.42.0 | Spring physics, layout animations. |
| **Editor** | Tiptap 3.x | Rich-text (compose). |
| **Charts** | Recharts 2.x | Analytics. |
| **DnD** | @dnd-kit/core 6.3.1 | Calendar drag-drop. |

### Auth & Backend

| Layer | Recommended Stable | Notes |
|---|---|---|
| **Auth** | NextAuth 4.24.14 | Stable. Auth.js v5 only after careful migration — v5 is still beta-tagged in many flows. |
| **ORM** | Prisma 7.8.0 | TypeScript-first. Migrations only (no `db:push` in prod). |
| **Database** | PostgreSQL 18.4 | Production. PostgreSQL 19 is beta — NOT production. |
| **Connection pooler** | PgBouncer 1.23.x | Transaction mode, `pool_size=20`. |
| **Rate limiting** | @upstash/ratelimit 2.x | Redis-backed (works across instances). |
| **Structured logging** | pino 9.x | JSON logs, request IDs. |
| **Error tracking** | @sentry/nextjs 8.x | Errors + performance. |
| **Metrics** | prom-client 15.x | Prometheus endpoint. |
| **Tracing** | @opentelemetry/sdk-node 1.x | Distributed traces. |

### Workers & Realtime

| Layer | Recommended Stable | Notes |
|---|---|---|
| **Job queue** | BullMQ 5.x | Redis-backed. Replaces DB-polling. |
| **Redis** | Redis 7.4.x | Queue + rate limit + socket.io adapter. |
| **Realtime** | socket.io 4.8.x | With `@socket.io/redis-adapter` 8.x for horizontal scaling. |
| **Concurrency** | p-limit 6.x | Per-platform semaphore in worker. |

### Media & Storage

| Layer | Recommended Stable | Notes |
|---|---|---|
| **Object storage** | S3-compatible (R2 / MinIO / AWS S3) | Presigned URL uploads. |
| **S3 SDK** | @aws-sdk/client-s3 3.x | Presigned URLs. |
| **Image processing** | sharp 0.33.x | Thumbnails, dimensions, magic-byte validation. |
| **Malware scan** | ClamAV + clamav.js 1.x | On-upload scan. |
| **CDN** | CloudFront / Cloudflare / R2 | Serve media from edge. |

### Python Backend (if used for specific services)

| Layer | Recommended Stable | Notes |
|---|---|---|
| **Framework** | FastAPI 0.138.1 | Only if a Python service is warranted (e.g., ML, heavy data). |
| **Validation** | Pydantic 2.13.4 | |
| **ORM** | SQLAlchemy 2.0.51 | |
| **Migrations** | Alembic 1.18.5 | |
| **Workers** | Celery 5.6.3 | If Python workers are used. |
| **ASGI** | Uvicorn 0.48.0 | |
| **Lint/format** | Ruff 0.15.20 | |

> **Note:** Nashrino is currently a TypeScript-only stack. Python services should only be added if a specific need arises (e.g., ML-based content recommendations, heavy NLP). The default path is to stay TypeScript-native with BullMQ workers.

### Dev & CI

| Layer | Recommended Stable | Notes |
|---|---|---|
| **Test runner** | Vitest 2.x | Unit + integration. |
| **E2E** | Playwright 1.49.x | Critical flows. |
| **API mocking** | MSW 2.x | Mock Service Worker for adapter tests. |
| **Lint** | ESLint 9.x | With `@typescript-eslint` + `eslint-plugin-react-hooks`. |
| **Bundle analyzer** | @next/bundle-analyzer 15.x | Size budgets. |
| **Lighthouse CI** | @lhci/cli 0.14.x | Performance budgets. |
| **Container** | Docker 26.x + Compose v2 | Multi-stage builds. |
| **CI** | GitHub Actions | lint → typecheck → test → build → prisma check → security audit → docker build. |

---

## Architecture Principles (2026 Baseline)

### 1. Modular monolith first, not microservices

A serious modern architecture is **not** a simple Next.js template. The best shape is a **modular monolith** with strong boundaries:

```
Browser / PWA
  → Next.js App Router UI (RSC + client islands)
  → BFF / API layer (thin route handlers → service modules)
  → PostgreSQL (source of truth)
  → Redis / queue (jobs + cache + realtime)
  → background workers (BullMQ)
  → object storage / CDN (S3)
  → external social APIs (Telegram, IG, LinkedIn, Rubika, Bale)
  → observability stack (pino + Sentry + Prometheus + OpenTelemetry)
```

**Why modular monolith, not microservices:**
- Single deploy unit → simpler ops, no network overhead between services.
- Strong module boundaries → can extract to microservices later if scale demands.
- Shared Prisma client + types → no RPC schema drift.
- Easier debugging → one process, one log stream, one trace.

### 2. BFF layer: thin route handlers → service modules

API routes / server actions should be **thin**. They:
1. Validate input (Zod)
2. Check auth (`requireWorkspaceApi()` + `can()` RBAC)
3. Call a service module
4. Return typed responses

```typescript
// ❌ BAD: business logic in route handler
export async function POST(req: Request) {
  const body = await req.json()
  // ... 50 lines of business logic, DB calls, platform API calls ...
}

// ✅ GOOD: thin route → service
export async function POST(req: Request) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const parsed = validateBody(publishSchema, body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const result = await publishService.create(guard.workspace, parsed.data, guard.session)
  return NextResponse.json(result, { status: 201 })
}
```

### 3. Domain modules

Separate modules with their own service, repository, types, and tests:

```
src/modules/
  accounts/        — user, workspace, membership, RBAC
  channels/        — platform connections, tokens, validation
  content/         — posts, drafts, approvals, versions
  media/           — uploads, S3, processing, library
  campaigns/       — campaign CRUD, grouping
  calendar/        — scheduling, Jalali grid, drag-drop
  analytics/       — metrics, real stats ingestion, snapshots
  automations/     — IG comment-to-DM, rules engine
  notifications/   — in-app, email, push
  billing/         — plans, quotas, usage (future)
  team/            — invites, roles, permissions
```

Each module has:
- `service.ts` — business logic (called by API routes)
- `repository.ts` — Prisma queries (data access)
- `types.ts` — TypeScript types + Zod schemas
- `__tests__/` — unit + integration tests

### 4. Workers for all background work

Anything that shouldn't block a page request runs in a worker:
- Publishing (Telegram/Bale/Rubika/IG/LinkedIn)
- Retries (exponential backoff + jitter)
- Media processing (sharp thumbnails, S3 upload)
- Instagram automation (comment-to-DM)
- Analytics sync (periodic platform stats fetch)
- Webhook processing (inbound events from platforms)
- Notifications (email, push)

**Default queue: BullMQ (Redis-backed).** NOT DB-polling.

### 5. Realtime: SSE or WebSockets

Use realtime only where it adds value:
- ✅ Live publishing status (job progress)
- ✅ Inbox updates (new message)
- ✅ Queue depth changes
- ✅ Notification badge count

**Default: socket.io with Redis adapter** (for horizontal scaling). SSE is a simpler alternative if we don't need bidirectional.

### 6. Storage: S3-compatible, not local disk

Uploaded media lives in S3/R2/MinIO, not `public/uploads/`. Client uploads directly to S3 via presigned URL (bypasses Next.js body limit). CDN serves images from edge.

### 7. Security: real auth, RBAC, rate limits, audit logs, encrypted secrets

- Real auth (NextAuth 4.24.14, JWT sessions, strong secret)
- RBAC (`can(role, permission)` on every mutating route)
- Rate limits (Redis-backed `@upstash/ratelimit`)
- Audit logs (`AuditLog` table for sensitive actions)
- Webhook signature verification (HMAC)
- Encrypted secrets (AES-256-GCM for platform tokens)
- Strict environment separation (`.env.example`, no demo creds in prod)

### 8. Quality gates in CI

Every PR passes through:
- Lint (ESLint + Ruff if Python)
- Typecheck (`tsc --noEmit`)
- Unit tests (Vitest)
- API contract tests
- E2E tests (Playwright — critical flows only)
- Accessibility tests (axe-core)
- Build (`next build`)
- Docker build
- Migration check (`prisma migrate diff --exit-code`)
- Security audit (`bun audit` + Trivy image scan)

### 9. Observability before launch, not after

- Structured logs (pino JSON with request IDs)
- Error tracking (Sentry)
- Metrics (Prometheus: HTTP latency, queue depth, publish success rate)
- Tracing (OpenTelemetry)
- Uptime checks (external probe to `/api/health`)
- Worker dashboards (BullMQ board)
- Alerting (Sentry alerts + Prometheus alertmanager)

### 10. UI system: token-driven

Design tokens for:
- Spacing (4/8/12/16/24/32/48px scale)
- Radius (sm/md/lg/xl/full)
- Glass (backdrop-blur levels)
- Shadows (sm/md/lg/xl)
- Buttons (variants, sizes, states)
- Tags / badges
- Typography (Vazirmatn, sizes, weights)
- RTL (logical properties, not physical)
- Dark mode (CSS variables, `next-themes`)
- High contrast (WCAG AAA)

---

## Version Migration Plan

### Current → Target

| Layer | Current | Target | Migration |
|---|---|---|---|
| Runtime | Bun (dev) | Node 24.18 LTS (prod) | Phase 3 (Docker) |
| Next.js | 16.1.1 | 16.2.9 | Patch upgrade |
| React | 19.0.0 | 19.2.7 | Minor upgrade |
| TypeScript | 5.x | 6.0.3 | Major — audit types |
| Tailwind | 4.x | 4.3.1 | Patch upgrade |
| TanStack Query | 5.82.0 | 5.101.1 | Minor upgrade |
| Zod | 3.x or 4.x | 4.4.3 | Ensure v4 (fix `z.record()` bug) |
| Framer Motion | 12.23.2 | 12.42.0 | Patch upgrade |
| NextAuth | 4.24.11 | 4.24.14 | Patch upgrade |
| Prisma | 6.11.1 | 7.8.0 | **Major upgrade — breaking changes** |
| Database | SQLite | PostgreSQL 18.4 | Phase 4 |
| Rate limiter | in-memory | @upstash/ratelimit 2.x | Phase 8 |
| Logging | console.log | pino 9.x | Phase 2 |
| Worker queue | DB-polling | BullMQ 5.x | Phase 6 |
| Realtime | single-process | socket.io + Redis adapter | Phase 7 |
| Media | local disk | S3 presigned | Phase 9 |

### Prisma 6 → 7 migration notes

Prisma 7 has breaking changes from 6.x:
- `prisma generate` output location changed
- Some query API changes (check migration guide)
- `@prisma/client` import path may change
- **Test thoroughly** — run full test suite against Prisma 7 before merging

**Recommendation:** Upgrade to Prisma 7 in Phase 4 (alongside PostgreSQL migration) — both are DB-layer changes, do them together to avoid two migration cycles.

---

## Rules for Version Management

1. **Pin in `package.json`** — use `^` for patch, `~` for minor, exact for major.
2. **Update `bun.lock`** on every change.
3. **Run `bun audit` weekly** — fix high/critical within 48h.
4. **Don't chase "latest"** — stay on stable LTS unless there's a compelling reason.
5. **Test upgrades in a branch** — never upgrade directly on `main`.
6. **Document breaking changes** in `docs/DECISION_LOG.md`.
7. **Renovate/Dependabot** — enable for patch/minor upgrades (auto-PR), disable for major (manual review).

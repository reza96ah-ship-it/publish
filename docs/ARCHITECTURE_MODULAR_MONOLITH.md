# Architecture — Modular Monolith (2026 Baseline)

**Created:** 2025-06-26
**Principle:** Modular monolith with strong boundaries. Not microservices, not a flat Next.js template.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Browser / PWA (RTL Persian UI)                    │
│  Next.js App Router • RSC + client islands • Zustand • TanStack    │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Caddy (reverse proxy, TLS)                      │
│  HTTP/2 • Brotli • HSTS • rate-limit-early                          │
└──────┬──────────────────────────────────┬───────────────────────────┘
       │ :3000                             │ :3003 (WebSocket upgrade)
       ▼                                  ▼
┌──────────────────────────┐   ┌──────────────────────────────────────┐
│  Next.js 16 app (Node 24) │   │  Realtime (socket.io + Redis adapter)│
│  ┌──────────────────────┐ │   │  JWT handshake auth                  │
│  │  BFF / API layer     │ │   │  Room authorization                  │
│  │  (thin route handlers│ │   │  POST /emit (shared secret)          │
│  │   → service modules) │ │   └──────────────▲───────────────────────┘
│  └──────────┬───────────┘ │                  │
│             │ calls        │                  │ emit job:status
│  ┌──────────▼───────────┐ │                  │
│  │  Domain Modules      │ │                  │
│  │  accounts, channels, │ │                  │
│  │  content, media,     │ │                  │
│  │  campaigns, calendar,│ │                  │
│  │  analytics,          │ │                  │
│  │  automations,        │ │                  │
│  │  notifications,      │ │                  │
│  │  billing, team       │ │                  │
│  └──────────┬───────────┘ │                  │
│             │ Prisma       │                  │
└─────────────┼──────────────┘                  │
              │                                 │
              ▼                                 │
┌──────────────────────────┐                    │
│  PostgreSQL 18.4         │◄──────┐            │
│  (source of truth)       │       │            │
│  Prisma 7.8 migrations   │       │            │
│  PgBouncer pooling       │       │            │
└────────────▲─────────────┘       │            │
             │                     │            │
             │ shared DB           │            │
             │                     │            │
┌────────────┴─────────────┐       │            │
│  Worker (BullMQ)          │───────┘            │
│  publish-jobs queue       │                    │
│  media-processing queue   │                    │
│  analytics-sync queue     │                    │
│  webhook-process queue    │                    │
│  notifications queue      │                    │
│                           │                    │
│  5 adapters →             │                    │
│  Telegram, Bale, Rubika,  │                    │
│  Instagram, LinkedIn      │                    │
└──────────┬────────────────┘                    │
           │                                     │
           ▼                                     │
┌──────────────────────────┐                    │
│  Redis 7.4               │◄────────────────────┘
│  • BullMQ queues         │
│  • @upstash/ratelimit    │
│  • socket.io adapter     │
│  • cache (optional)      │
└──────────────────────────┘

┌──────────────────────────┐    ┌──────────────────────────┐
│  S3 / R2 / MinIO         │    │  Observability Stack     │
│  • media uploads         │    │  • pino (structured logs) │
│  • presigned URLs        │    │  • Sentry (errors)        │
│  • CDN (CloudFront)      │    │  • Prometheus (metrics)   │
│  • lifecycle policies    │    │  • OpenTelemetry (traces) │
└──────────────────────────┘    └──────────────────────────┘
```

---

## BFF / API Layer Pattern

API routes are **thin**. They validate, authorize, delegate to a service, return typed responses.

### Route handler contract

```typescript
// src/app/api/content/route.ts
import { NextResponse } from 'next/server'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import { validateBody, validateParams, paginationSchema } from '@/lib/validations'
import { contentService } from '@/modules/content/service'

export async function GET(req: Request) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error

  const { searchParams } = new URL(req.url)
  const parsed = validateParams(paginationSchema, Object.fromEntries(searchParams))
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const result = await contentService.list(guard.workspace.id, parsed.data)
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  const parsed = validateBody(contentCreateSchema, body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // RBAC: only editor+ can create content
  if (!can(guard.role, 'content.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await contentService.create(guard.workspace.id, parsed.data, guard.session.userId)
  return NextResponse.json(result, { status: 201 })
}
```

### What route handlers do NOT do

- ❌ Call Prisma directly (that's the repository's job)
- ❌ Call platform APIs directly (that's the adapter/worker's job)
- ❌ Contain business logic (that's the service's job)
- ❌ Transform data (that's the service's job — routes return what the service returns)

---

## Domain Modules

### Module structure

```
src/modules/{module-name}/
  service.ts          — business logic (called by API routes / workers)
  repository.ts       — Prisma queries (data access only)
  types.ts            — TypeScript types + Zod schemas
  constants.ts        — enums, config
  __tests__/
    service.test.ts   — unit tests for business logic
    repository.test.ts — integration tests for DB queries
```

### Module inventory (11 modules)

| Module            | Responsibility                                                            | Key tables                                               |
| ----------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| **accounts**      | User, Workspace, WorkspaceMember, RBAC, session                           | User, Workspace, WorkspaceMember                         |
| **channels**      | Platform connections, token encryption, validation, circuit breaker state | Platform                                                 |
| **content**       | Posts, drafts, approvals, rejections, versions, comments                  | Content, ContentVersion, ContentComment, ContentPlatform |
| **media**         | Uploads (S3 presigned), processing (sharp), library, quotas               | Media                                                    |
| **campaigns**     | Campaign CRUD, grouping, status                                           | Campaign                                                 |
| **calendar**      | Scheduling, Jalali month grid, drag-drop reschedule                       | PublishJob (read), Content (read)                        |
| **analytics**     | Real stats ingestion, snapshots, metrics aggregation                      | AnalyticsSnapshot                                        |
| **automations**   | IG comment-to-DM, rules engine, execution log                             | AutomationRule, AutomationEvent (new)                    |
| **notifications** | In-app, email (future), push (future), read state                         | Notification                                             |
| **billing**       | Plans, quotas, usage tracking (future)                                    | Subscription, Invoice (new)                              |
| **team**          | Invites, roles, permissions, audit                                        | WorkspaceMember, AuditLog                                |

### Module communication rules

1. **Modules call each other via service imports** — not via HTTP, not via events (unless async).
   ```typescript
   // ✅ GOOD: content service calls media service
   import { mediaService } from '@/modules/media/service'
   const thumbnail = await mediaService.getThumbnail(mediaId)
   ```
2. **Modules do NOT import each other's repositories** — always go through the service.
3. **Modules do NOT import each other's Prisma models directly** — use the service's typed return.
4. **Cross-module data flow uses typed interfaces** — `types.ts` exports the contract.

### Example: content module

```typescript
// src/modules/content/types.ts
import { z } from 'zod'

export const contentCreateSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(5000).optional(),
  // ...
})

export type ContentCreateInput = z.infer<typeof contentCreateSchema>
export type Content = {
  id: string
  title: string
  body: string | null
  status: 'draft' | 'scheduled' | 'published' | 'review' | 'rejected'
  // ...
}

// src/modules/content/repository.ts
import { db } from '@/lib/db'
import type { Content } from './types'

export const contentRepository = {
  async list(
    workspaceId: string,
    opts: { cursor?: string; limit: number }
  ): Promise<{ data: Content[]; nextCursor: string | null }> {
    // Prisma query with cursor pagination
  },
  async create(workspaceId: string, data: ContentCreateInput, authorId: string): Promise<Content> {
    // Prisma insert
  },
  async findById(id: string, workspaceId: string): Promise<Content | null> {
    // Prisma findFirst with workspace scoping
  },
}

// src/modules/content/service.ts
import { contentRepository } from './repository'
import { mediaService } from '@/modules/media/service'
import { publishService } from '@/modules/publish/service' // or inline in content
import type { Content, ContentCreateInput } from './types'

export const contentService = {
  async list(workspaceId: string, opts: { cursor?: string; limit: number }) {
    return contentRepository.list(workspaceId, opts)
  },

  async create(workspaceId: string, input: ContentCreateInput, authorId: string) {
    // 1. Validate media IDs belong to workspace
    if (input.mediaIds?.length) {
      await mediaService.validateOwnership(workspaceId, input.mediaIds)
    }
    // 2. Create content
    const content = await contentRepository.create(workspaceId, input, authorId)
    // 3. If scheduled, enqueue publish jobs
    if (input.scheduledAt) {
      await publishService.schedule(content.id, input.scheduledAt)
    }
    return content
  },
}
```

---

## Worker Architecture

### BullMQ queues

| Queue              | Concurrency    | Purpose                                                |
| ------------------ | -------------- | ------------------------------------------------------ |
| `publish-jobs`     | 5 per platform | Telegram, Bale, Rubika, Instagram, LinkedIn publishing |
| `media-processing` | 3              | Sharp thumbnails, S3 upload, ClamAV scan               |
| `analytics-sync`   | 1              | Periodic platform stats fetch (hourly)                 |
| `webhook-process`  | 5              | Inbound events from platforms                          |
| `notifications`    | 10             | Email, push, in-app notification dispatch              |
| `automations`      | 3              | IG comment-to-DM rule execution                        |

### Worker process

```typescript
// mini-services/worker/index.ts
import { Worker } from 'bullmq'
import { connection } from './lib/redis'

const publishWorker = new Worker('publish-jobs', processPublishJob, {
  connection,
  concurrency: 5,
})

const mediaWorker = new Worker('media-processing', processMediaJob, {
  connection,
  concurrency: 3,
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info({ msg: 'SIGTERM received, closing workers...' })
  await Promise.all([publishWorker.close(), mediaWorker.close()])
  process.exit(0)
})
```

### Why BullMQ over DB-polling

| Feature             | DB-polling (current)    | BullMQ (target)                   |
| ------------------- | ----------------------- | --------------------------------- |
| Latency             | 2s (poll interval)      | <100ms (event-driven)             |
| Concurrency control | None (fires 10 at once) | Per-queue, per-worker             |
| Dead-letter queue   | No                      | Yes (failed jobs after N retries) |
| Rate limiting       | No                      | Per-queue rate limiter            |
| Prioritization      | No                      | Job priority                      |
| Delayed jobs        | No                      | `job.opts.delay`                  |
| Observability       | No                      | BullMQ dashboard (`bullboard`)    |
| Graceful shutdown   | No (in-flight lost)     | Yes (awaits in-flight)            |

---

## Instagram Professional Account Integration

Instagram must be done **properly** via the official Meta API. No scraping, no password login automation, no unofficial DM, no fake auto-publish claims.

### OAuth flow

1. User clicks "Connect Instagram" → redirect to Meta OAuth.
2. Meta redirects back with `code`.
3. Server exchanges `code` for `access_token` + `long_lived_token`.
4. Store encrypted token in `Platform.tokenSecret`.
5. Validate by calling `GET /me/accounts` → fetch IG business account ID.

### Permissions needed

- `instagram_basic` — read profile
- `instagram_content_publish` — publish posts/reels
- `instagram_manage_comments` — read/reply to comments
- `instagram_manage_insights` — read analytics
- `pages_show_list` — required for IG business account
- `pages_read_engagement` — required for comment webhooks

### Publishing flow (official API)

1. Create media container: `POST /{ig-user-id}/media` → returns `container_id`.
2. Publish container: `POST /{ig-user-id}/media_publish` → returns `media_id`.
3. Check status: `GET /{media_id}?fields=status_code` → `FINISHED` / `IN_PROGRESS` / `ERROR`.

**Limitations:**

- Personal accounts: manual/reminder mode only (no API publish).
- Business/Creator accounts: API publish supported.
- Carousel: up to 10 images/videos per post.
- Reels: supported via `media_type=REELS`.

### Comment-to-DM automation (official)

1. Subscribe to `comments` webhook via Meta App Dashboard.
2. Webhook receives `{entry: [{changes: [{field: "comments", value: {media_id, text, from: {id, username}}}]}]}`.
3. Verify `X-Hub-Signature-256` HMAC.
4. Match comment against automation rules (regex/keyword).
5. Send DM via `POST /{ig-user-id}/messages` with `recipient: {comment_id: ...}`.

**Safety:**

- Must respond within 7 days of the comment (Meta policy).
- Must not send promotional content first (24h window rule).
- Rate limit: 1 message per second per user.

### Manual fallback

For personal accounts or API limitations:

- UI shows "Manual publish required" reminder.
- Content is prepared (caption + media ready to copy).
- User publishes manually on the Instagram app.
- Mark as "manually published" in the UI.

---

## UI Design Token System

### Token categories

```css
/* src/app/globals.css */
@theme {
  /* Spacing (4px base scale) */
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-12: 48px;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Glass */
  --glass-blur-sm: 8px;
  --glass-blur-md: 16px;
  --glass-blur-lg: 24px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);

  /* Typography */
  --font-sans: 'Vazirmatn', system-ui, sans-serif;
  --font-mono: 'Vazirmatn Code', monospace;
  --text-xs: 11px;
  --text-sm: 12px;
  --text-base: 13px;
  --text-lg: 15px;
  --text-xl: 18px;

  /* Colors (OKLCH) */
  --color-bg: oklch(1 0 0);
  --color-surface: oklch(0.98 0 0);
  --color-accent: oklch(0.6 0.2 250);
  /* ... */

  /* RTL */
  --direction: rtl;
}
```

### Component states

Every interactive component must define:

- Default
- Hover
- Focus-visible (keyboard)
- Active (pressed)
- Disabled
- Loading (spinner)
- Error
- Success

### Accessibility

- WCAG 2.2 AA minimum, AAA where possible
- `prefers-reduced-motion` respected (disable Framer Motion springs)
- `prefers-contrast: high` respected (increase contrast)
- Focus rings always visible (`:focus-visible`)
- Screen reader announcements (`aria-live`)
- RTL-aware logical properties (`ms-2`, not `ml-2`)

---

## Performance Budgets

| Metric                    | Budget | Enforcement                   |
| ------------------------- | ------ | ----------------------------- |
| Initial JS (gzipped)      | <350KB | `@next/bundle-analyzer` in CI |
| Per-route chunk (gzipped) | <200KB | `@next/bundle-analyzer` in CI |
| LCP (dashboard)           | <2.5s  | Lighthouse CI                 |
| INP                       | <200ms | Lighthouse CI                 |
| CLS                       | <0.1   | Lighthouse CI                 |
| Lighthouse Performance    | ≥90    | Lighthouse CI (blocks merge)  |
| Lighthouse Accessibility  | ≥95    | Lighthouse CI (blocks merge)  |
| API p95 (read)            | <200ms | Sentry performance            |
| API p95 (write)           | <500ms | Sentry performance            |
| Worker queue delay (p95)  | <10s   | BullMQ metrics                |
| Image (thumbnail)         | <50KB  | sharp WebP                    |
| Image (original)          | <500KB | client-side resize            |

---

## Migration Path: Current → Modular Monolith

This is a **gradual** migration. Do NOT rewrite all at once.

### Phase 1 (Week 1) — P0 fixes

- No module extraction yet. Fix blockers in existing structure.

### Phase 2-3 (Weeks 2-3) — Observability + Docker

- Add pino, Sentry, health endpoint.
- Containerize the current structure.

### Phase 4-5 (Weeks 4-5) — Postgres + Security

- Migrate to Postgres.
- Encrypt tokens, enforce RBAC.

### Phase 6-7 (Weeks 6-7) — Worker + Realtime

- Migrate to BullMQ.
- Add realtime auth.

### Phase 8 (Week 8) — Start module extraction

- Extract `media` module first (it's self-contained).
- Then `content`, `channels`, `accounts`.
- Each extraction is a separate PR.

### Phase 9-10 (Weeks 9-10) — Complete modules + testing

- Finish all 11 modules.
- Add comprehensive tests.
- Performance budgets.

### Module extraction PR checklist

- [ ] Create `src/modules/{name}/` with `service.ts`, `repository.ts`, `types.ts`.
- [ ] Move business logic from route handlers to service.
- [ ] Move Prisma queries from route handlers to repository.
- [ ] Update all route handlers to call the service.
- [ ] Update tests to test the service + repository separately.
- [ ] No change in API response shape (backward compatible).
- [ ] No change in DB schema (unless explicitly scoped).

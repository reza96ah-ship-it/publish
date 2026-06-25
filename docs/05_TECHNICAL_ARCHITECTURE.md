# 05 — Technical Architecture & Data Model

> **Purpose**: The engineering blueprint. How the system is structured, how data flows,
> how it scales, and how it stays resilient. Read this before writing any backend or
> worker code.

## Table of Contents

1. [System Architecture (C4 — Container view)](#1-system-architecture-c4--container-view)
2. [Component Responsibilities](#2-component-responsibilities)
3. [Request & Data Flow](#3-request--data-flow)
4. [Publishing Worker Architecture (deep dive)](#4-publishing-worker-architecture-deep-dive)
5. [Channel Adapter Contract](#5-channel-adapter-contract)
6. [Realtime (WebSocket) Architecture](#6-realtime-websocket-architecture)
7. [Data Model (full schema)](#7-data-model-full-schema)
8. [API Design](#8-api-design)
9. [Security Architecture](#9-security-architecture)
10. [Observability Architecture](#10-observability-architecture)
11. [Infrastructure & Deployment](#11-infrastructure--deployment)
12. [Scalability & Capacity](#12-scalability--capacity)
13. [Resilience & Disaster Recovery](#13-resilience--disaster-recovery)
14. [AI Integration Architecture](#14-ai-integration-architecture)
15. [Development Environment](#15-development-environment)

---

## 1. System Architecture (C4 — Container view)

```
┌────────────────────────────────────────────────────────────────────────┐
│                              USER (browser)                            │
│              Next.js 16 PWA · RTL · Vazirmatn · dark/light             │
└───────────────┬────────────────────────────────────┬───────────────────┘
                │  HTTPS (relative paths; Caddy gateway)│  WSS (socket.io)
                ▼                                      ▼
┌───────────────────────────┐         ┌──────────────────────────────────┐
│   Caddy reverse proxy     │         │  Realtime mini-service (socket.io)│
│   TLS · routing · gateway │         │  port 3003 · broadcasts job/inbox│
└───────────────┬───────────┘         └──────────────┬───────────────────┘
                │                                     │ subscribe (redis pubsub)
                ▼                                     │
┌───────────────────────────────────┐                │
│   FastAPI Backend (uvicorn)       │◄───────────────┘
│   - REST API (Pydantic v2)        │
│   - Auth (JWT cookie)             │
│   - RBAC dependency               │
│   - Pydantic validation           │
│   - OpenAPI auto-docs             │
└──────┬────────────┬───────────┬────┘
       │            │           │ enqueue
       │            │           ▼
       │            │  ┌────────────────────┐
       │            │  │   Redis 7          │
       │            │  │  - Celery broker   │
       │            │  │  - result backend  │
       │            │  │  - pubsub (rt)     │
       │            │  └────────┬───────────┘
       │            │           │
       │            │           ▼
       │            │  ┌────────────────────────────────┐
       │            │  │  Celery workers (per-channel Q)│
       │            │  │  - instagram_queue             │
       │            │  │  - rubika_queue                │
       │            │  │  - telegram_queue              │
       │            │  │  - linkedin_queue              │
       │            │  │  - ingest_queue (webhooks)     │
       │            │  │  - analytics_queue             │
       │            │  └────────┬───────────────────────┘
       ▼            ▼           │
┌──────────────────────────┐    │ publish/reply/insights
│  PostgreSQL 16           │◄───┘
│  - tenant-scoped tables  │
│  - read replica (anlytc) │
└──────────────────────────┘
       ▲
       │
┌──────┴───────────────┐   ┌──────────────────────┐
│  Object storage      │   │  Secrets manager     │
│  (media files)       │   │  (tokens, keys)      │
└──────────────────────┘   └──────────────────────┘

External APIs: Meta Graph API · Rubika Bot API · Telegram Bot API · LinkedIn API · Zarinpal (billing) · z-ai-web-dev-sdk (AI)
```

### Design principles
1. **Tenant isolation first** — every query is `workspace_id`-scoped at the data layer.
2. **Stateless adapters** — all state lives in Postgres; channel adapters are pure
   functions over (account, content) → result.
3. **Resilient by default** — idempotent, retrying, circuit-broken, DLQ-backed.
4. **Backend-of-truth** — the frontend is a thin client; no business logic in the
   browser; z-ai-web-dev-sdk only server-side.
5. **Relative-path requests** — all client calls go through Caddy (no absolute URLs);
   cross-service calls use `?XTransformPort=<port>` per the gateway contract.

---

## 2. Component Responsibilities

| Component | Tech | Responsibility |
|-----------|------|----------------|
| **Frontend** | Next.js 16, TS, Tailwind 4, shadcn/ui | UI rendering, optimistic updates, RTL/Jalali, PWA shell. No secrets. |
| **Caddy gateway** | Caddy | TLS, routing, port-transform (`XTransformPort`), static assets. |
| **Backend API** | FastAPI, Pydantic v2 | REST endpoints, auth, RBAC, validation, orchestration, OpenAPI. |
| **Realtime service** | socket.io (mini-service, port 3003) | Push job/inbox/notification events to clients; subscribes to Redis pubsub. |
| **Workers** | Celery 5 | Per-channel publishing, webhook ingest, analytics ingestion, scheduled dispatch (beat). |
| **Redis** | Redis 7 | Celery broker + result backend + pubsub + short-lived cache. |
| **PostgreSQL** | PostgreSQL 16 | Source of truth; tenant-scoped schema. |
| **Object storage** | S3-compatible / local volume | Media files (originals + processed variants). |
| **Secrets manager** | env + encrypted DB fields (AES-256) | OAuth/bot tokens at rest. |
| **CI** | GitHub Actions | lint/typecheck/test/build/migrate/audit gates. |

---

## 3. Request & Data Flow

### 3.1 Compose → Schedule → Publish (happy path)
1. User composes in Next.js; on "Schedule", `POST /api/contents` creates a `content`
   row, then `POST /api/publish-jobs` creates one `publish_job` per selected platform
   (status `pending`, `scheduled_at` set, `idempotency_key` generated).
2. FastAPI validates readiness (caption length, media specs, token validity) and
   returns 201 with job IDs.
3. Celery beat (every 30s) selects `pending` jobs where `scheduled_at ≤ now` and routes
   each to its channel queue (`instagram_queue`, etc.).
4. Worker picks the job, sets status `processing` (persisted *before* the API call),
   calls the adapter's `publish()`.
5. Adapter executes the channel-specific flow (e.g., IG two-step), returns
   `PublishResult(external_id, raw_response)`.
6. Worker sets status `success` (or `failed` with error), records a `publish_attempt`,
   publishes a `job.updated` event to Redis pubsub.
7. Realtime service fans the event to the subscribed workspace's clients; dashboard
   updates live.

### 3.2 Failure path
1. Adapter returns a transient error (5xx, 429, network) → worker schedules a retry
   with exponential backoff + jitter; records a `publish_attempt` with status `retry`.
2. After max attempts → status `failed`, job → DLQ; Action Center event raised; user
   notified.
3. If N consecutive failures on a channel → circuit breaker trips: channel marked
   `error`, new jobs held, health check runs; on recovery, channel marked `active` and
   held jobs released.

### 3.3 Webhook ingest (Phase 2 — IG comments/DMs)
1. Meta posts to `/webhooks/instagram` (verified via `hub.challenge` + app secret HMAC).
2. FastAPI verifies signature, idempotently inserts `inbox_messages`, enqueues an
   `ingest_queue` task.
3. Ingest task evaluates automation rules → enqueues DM task (if matched, within
   window) → publishes `inbox.new` + `automation.event` to Redis pubsub.

### 3.4 Analytics ingestion
1. Nightly Celery beat job pulls IG/LinkedIn insights per connected account → upserts
   `analytics_snapshots` (unique on `workspace_id, date, platform, metric_type`).
2. Analytics endpoints read snapshots (and live counters) → served to dashboard.

---

## 4. Publishing Worker Architecture (deep dive)

This is the heart of the system and the source of the ≥98% success-rate NFR.

### 4.1 Queue topology
One Celery queue **per channel adapter** + utility queues:
- `instagram_queue`, `rubika_queue`, `telegram_queue`, `linkedin_queue`, `eitaa_queue`
- `ingest_queue` (webhook → inbox/automation)
- `analytics_queue` (insight pulls, report generation)
- `default` (misc)

**Rationale**: channel rate limits differ wildly (IG = 100/24h, TG = 30/s, Rubika =
per-bot). A shared queue would let a rate-limited channel block others. Per-channel
queues isolate backpressure.

### 4.2 Job state machine
```
            ┌──────────┐  beat dispatch (scheduled_at≤now)
            │ pending  │─────────────────────────────┐
            └──────────┘                             ▼
                 ▲              ┌───────────┐   adapter.publish()
                 │ reset on     │ processing│ ──────────────────────┐
                 │ retry        └─────┬─────┘                       │
                 │                    │ success                     │ fail (transient)
                 │                    ▼                             ▼
                 │              ┌──────────┐              ┌──────────┐
                 │              │ success  │              │  failed  │── retry? ──► pending
                 │              └──────────┘              └────┬─────┘
                 │                                              │ exhausted
                 │                                              ▼
                 │                                       ┌──────────┐
                 │                                       │   dlq    │
                 │                                       └──────────┘
                 │  action needed (token expired, media missing)
                 └──────────────────────────────────────────┐
                                                          ▼
                                                    ┌──────────┐
                                                    │  action  │
                                                    └──────────┘
```
- Transitions are persisted **before** the side effect (outbox pattern) so a crash
  mid-publish resumes correctly.
- `processing` jobs have a visibility timeout; if a worker dies, the job returns to
  `pending` (Celery `acks_late=True` + `task_reject_on_worker_lost`).

### 4.3 Idempotency
- Every `publish_job` has `idempotency_key = uuid4()`.
- Before retry, the adapter checks downstream for an existing publish (e.g., IG: query
  recent media; Rubika: optional message-id check). If found, mark `success` without
  re-publishing.
- The DB has a unique constraint on `(workspace_id, idempotency_key)` to prevent
  duplicate job creation on client retry.

### 4.4 Retry policy
- Backoff: base 1s, factor 2, cap 5 min, jitter ±20%.
- Max attempts per channel (configurable): IG=5, Rubika=5, TG=5, LI=4.
- Retryable: 5xx, 429, network timeouts, container-creation 4xx that are transient.
- Non-retryable: 400 (bad content), 401 (auth — refresh token first, then retry once;
  if still 401 → `action`), 403 (permission — `action`).

### 4.5 Circuit breaker
- Per `(workspace_id, platform)` trip: 5 consecutive `failed` in 60s → `OPEN`.
- OPEN: new jobs for that channel held in `pending` (not dispatched); a health-check
  task runs every 60s.
- HALF-OPEN: health check passes → release held jobs; 1 failure → back to OPEN.
- CLOSED: after 5 consecutive successes, reset failure counter.
- State stored in Redis (TTL) + mirrored to `platforms.status` for UI.

### 4.6 Dead-letter queue
- Jobs exhausting retries move to `dlq` (a dedicated DB state + a Celery DLQ).
- UI: Queue sub-tab → "Failed" filter shows DLQ jobs with last error + "Retry" /
  "Discard" actions. Retry re-arms `idempotency_key` (new key) and resets attempts.

### 4.7 Scheduled-time accuracy
- Celery beat runs every 30s, selects due jobs, dispatches.
- Workers are sized so queue depth stays near 0 under normal load; an autoscaler
  (or fixed sizing from capacity planning) prevents lag.
- Metric: `publish_lag_seconds = started_at - scheduled_at`; alert if P95 > 2min.

---

## 5. Channel Adapter Contract

Every channel adapter implements this interface (Python ABC):

```python
class HealthResult(BaseModel):
    healthy: bool
    status: str  # active | expired | error | disconnected
    last_error: str | None

class ReadinessIssue(BaseModel):
    code: str          # caption_too_long | media_missing | token_expired | ...
    message: str       # Persian, actionable
    platform: str

class ReadinessResult(BaseModel):
    ready: bool
    issues: list[ReadinessIssue]

class PublishResult(BaseModel):
    external_id: str | None
    raw_response: dict
    status: str        # success | failed | action
    error: str | None

class ChannelAdapter(ABC):
    platform: str

    @abstractmethod
    async def health_check(self, account: Platform) -> HealthResult: ...

    @abstractmethod
    async def validate_readiness(self, content: Content, account: Platform) -> ReadinessResult: ...

    @abstractmethod
    async def publish(self, job: PublishJob) -> PublishResult: ...  # idempotent

    @abstractmethod
    async def refresh_token(self, account: Platform) -> Platform: ...

    # Phase 2
    async def fetch_inbox(self, account: Platform, since: datetime) -> list[InboundMessage]: ...
    async def reply(self, account: Platform, message: InboxMessage, text: str) -> ReplyResult: ...
    async def send_dm(self, account: Platform, recipient_id: str, message: str, tag: str | None) -> ReplyResult: ...
```

### Adapter implementations
- **InstagramAdapter**: two-step publish (`/media` → `/media_publish`); carousel children;
  Reels via resumable upload (`rupload.facebook.com`); Stories; reads
  `/content_publishing_limit`; sets `is_ai_generated`; token refresh (long-lived →
  refreshed at ~expiry); webhooks for comments/messages/mentions.
- **RubikaAdapter**: `botapi.rubika.ir/v3`; maps content → text/photo/video/document +
  inline keypad CTA; retry on 5xx/429; manual fallback on persistent failure.
- **TelegramAdapter**: `sendMessage`/`sendPhoto`/`sendVideo`/`sendMediaGroup`; markdown;
  per-chat rate pacing; `getUpdates` polling (or webhook) for inbox.
- **LinkedInAdapter**: text/image/article/video share; two-step image upload; token
  refresh.
- **EitaaAdapter** (P3): bot-token pattern like Rubika.

### Adapter cross-cutting
- Every call wrapped in a retry decorator (channel-specific policy).
- Every call emits a metric (`adapter.<platform>.<call>.{success,latency}`).
- Every call logged with `trace_id`, `job_id`, `workspace_id` (never logs secrets).

---

## 6. Realtime (WebSocket) Architecture

Per the gateway rules, realtime uses a **socket.io mini-service on port 3003**; the
frontend connects via `io("/?XTransformPort=3003")`.

### Flow
1. Frontend authenticates the socket with its JWT (cookie).
2. Service validates the JWT, resolves `workspace_id`, joins a room `ws:<workspace_id>`.
3. Backend (workers / API) publish events to Redis pubsub channel `events:<workspace_id>`.
4. Realtime service subscribes, fans out to the room.

### Event types
- `job.updated` — { jobId, status, progress, error }
- `inbox.new` — { messageId, channel, type }
- `notification.new` — { id, type, title }
- `automation.event` — { ruleId, status, policyWindowExpiresAt }
- `platform.status` — { platformId, status }

### Resilience
- Socket reconnection with backoff; missed events backfilled via REST on reconnect
  (client sends `lastEventId`).
- Service is stateless (rooms derived from JWT); horizontally scalable behind Caddy
  (sticky sessions not required because pubsub fans out to all instances).

---

## 7. Data Model (full schema)

Unified PostgreSQL schema (extends existing Alembic migrations). Naming: `snake_case`
tables; `id` PK (bigserial or cuid). Every tenant-scoped table has `workspace_id`.

### 7.1 Identity & tenancy

```sql
users (
  id PK, email UNIQUE, password_hash, full_name, is_active,
  totp_secret NULL, created_at, updated_at
)

workspaces (
  id PK, name, slug UNIQUE, timezone DEFAULT 'Asia/Tehran',
  persian_digits DEFAULT true, plan DEFAULT 'free',
  storage_quota_bytes, seats_quota, channels_quota,
  created_at, updated_at
)

workspace_members (
  id PK, workspace_id FK, user_id FK, role,  -- admin|editor|approver|viewer
  created_at,
  UNIQUE(workspace_id, user_id)
)
```

### 7.2 Store / brand kit (extends existing `stores`)

```sql
stores (
  id PK, workspace_id FK UNIQUE,
  name, category, phone, description,
  logo_media_id FK NULL, avatar_media_id FK NULL,
  brand_primary_color DEFAULT '#0F766E',
  brand_accent_color DEFAULT '#2563EB',
  brand_voice, default_cta, content_guidelines,
  default_hashtags, caption_footer,
  timezone DEFAULT 'Asia/Tehran', is_active,
  created_at, updated_at
)
```

### 7.3 Platforms / channel connections

```sql
platforms (
  id PK, workspace_id FK,
  type,            -- instagram|rubika|telegram|linkedin|eitaa
  name, username, avatar_url,
  access_token_enc, refresh_token_enc, token_expires_at,  -- encrypted at rest
  -- channel-specific config (bot_token_enc for rubika/telegram; page_id for IG, etc.)
  meta JSONB DEFAULT '{}',
  account_kind,    -- professional|personal (IG); channel|group (TG); etc.
  status DEFAULT 'active',  -- active|expired|error|disconnected
  last_success_at, last_error,
  circuit_state DEFAULT 'closed',  -- closed|open|half_open
  created_at, updated_at
)
INDEX (workspace_id, type)
```

### 7.4 Campaigns

```sql
campaigns (
  id PK, workspace_id FK,
  name, description,
  status DEFAULT 'active',  -- active|paused|completed|archived
  start_date, end_date,
  goal_type, goal_value,
  health_label, health_color,
  owner_name, top_blocker,
  deleted_at NULL,
  created_at, updated_at
)
```

### 7.5 Content

```sql
contents (
  id PK, workspace_id FK,
  campaign_id FK NULL,
  title, body, hashtags, internal_note,
  status DEFAULT 'draft',  -- draft|review|approved|scheduled|published|failed
  scheduled_at, published_at, deleted_at NULL,
  author_name, created_at, updated_at
)

content_platforms (
  id PK, content_id FK, platform_id FK,
  -- per-channel overrides
  caption_override, hashtags_override, cta_override,
  created_at,
  UNIQUE(content_id, platform_id)
)
```

### 7.6 Media

```sql
media (
  id PK, workspace_id FK,
  name, file_type, file_size, url,
  storage_key,  -- object-storage key
  width, height, duration_seconds NULL,
  folder DEFAULT 'عمومی', tags TEXT[],
  thumbnail_url,
  created_at
)
INDEX (workspace_id, folder)
```

### 7.7 Publishing (the core)

```sql
publish_jobs (
  id PK, workspace_id FK,
  content_id FK, platform_id FK, campaign_id FK NULL,
  assignee_id FK NULL,
  status DEFAULT 'pending',  -- pending|processing|live|success|failed|action|dlq
  progress DEFAULT 0,
  process_label,
  idempotency_key UNIQUE,    -- per workspace
  scheduled_at, started_at, completed_at,
  error, retry_count DEFAULT 0,
  external_id,               -- published message/media id from channel
  created_at, updated_at
)
INDEX (workspace_id, status, scheduled_at)
INDEX (platform_id, status)

publish_attempts (
  id PK, job_id FK,
  attempt_number,
  status,        -- created|success|failed|retry
  action,        -- manual|scheduled|retry|health_check
  request_payload,  -- JSON, secrets redacted
  response_payload, -- JSON
  error,
  started_at, finished_at, created_at
)
INDEX (job_id, created_at)
```

### 7.8 Inbox & automation (Phase 2)

```sql
inbox_messages (
  id PK, workspace_id FK, platform_id FK,
  thread_id,                 -- groups a conversation
  parent_message_id NULL,
  sender_name, sender_avatar, sender_external_id,
  message, is_inbound,        -- true=incoming, false=outbound
  is_read, is_replied,
  type,                       -- comment|dm|mention
  external_id,
  assignee_id FK NULL,
  first_response_at NULL,
  resolved_at NULL,
  created_at
)
INDEX (workspace_id, is_read, created_at)
INDEX (thread_id)

automation_rules (
  id PK, workspace_id FK, platform_id FK,
  trigger_type, trigger_value,  -- comment_keyword|comment_regex
  target_scope, target_post_ids JSONB,
  dm_message, dm_media_id FK NULL,
  use_human_agent_tag DEFAULT false,
  enabled DEFAULT true,
  created_at, updated_at
)

automation_events (
  id PK, workspace_id FK, rule_id FK,
  trigger_message_id FK,        -- inbox_messages.id
  recipient_external_id,
  dm_message_id,                -- external id
  status,                       -- sent|skipped_window_expired|skipped_opt_out|failed
  policy_window_expires_at,
  created_at
)
INDEX (workspace_id, created_at)
```

### 7.9 Analytics

```sql
analytics_snapshots (
  id PK, workspace_id FK,
  date, platform NULL,  -- NULL = aggregate
  metric_type,          -- reach|impressions|engagement|followers|clicks|conversions
  value,
  created_at,
  UNIQUE(workspace_id, date, platform, metric_type)
)
INDEX (workspace_id, date)
```

### 7.10 Notifications & audit

```sql
notifications (
  id PK, workspace_id FK, user_id FK NULL,
  type, title, body, data JSONB,
  is_read DEFAULT false, created_at
)
INDEX (workspace_id, user_id, is_read)

audit_logs (
  id PK, workspace_id FK NULL, user_id FK NULL,
  action, target_type, target_id, metadata JSONB,
  ip, user_agent, created_at
)
INDEX (workspace_id, created_at)
```

### 7.11 Settings & billing

```sql
app_settings (id PK, key UNIQUE, value, type)

invoices (
  id PK, workspace_id FK,
  plan, amount, currency DEFAULT 'IRR',
  gateway, gateway_ref, status,  -- pending|paid|failed|refunded
  period_start, period_end,
  created_at, paid_at
)

subscription_events (
  id PK, workspace_id FK, event,  -- subscribe|upgrade|downgrade|cancel|renew
  details JSONB, created_at
)
```

### 7.12 Migration strategy
- New migration `0004_unified_schema` reconciles the prototype's Prisma models and the
  existing `0001/0002/0003` Alembic migrations into the above.
- Data-migration script ports existing `posts` → `contents` + `publish_jobs`,
  `media_assets` → `media`, `rubika_accounts` → `platforms` (type=rubika).
- Every future schema change is a reversible Alembic migration; CI runs up/down/up.

---

## 8. API Design

### 8.1 Conventions
- REST; JSON; versioned prefix `/api/v1`.
- Auth: JWT in `HttpOnly` cookie (`nashrino_session`); CSRF token for mutations.
- RBAC: FastAPI dependency `require_role(*roles)` on every route.
- Pagination: `?page=&pageSize=` + `total` in response; cursor pagination for inbox.
- Errors: `{ error: { code, message, details? } }` with proper HTTP status.
- OpenAPI at `/api/v1/openapi.json`; Swagger UI at `/docs` (admin-only in prod).

### 8.2 Endpoint map (key routes; full list in OpenAPI)

```
# Auth
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/password/reset
GET    /api/v1/auth/me

# Workspaces & members
GET    /api/v1/workspaces                 # list for current user
POST   /api/v1/workspaces
GET    /api/v1/workspaces/{id}
PATCH  /api/v1/workspaces/{id}
POST   /api/v1/workspaces/{id}/members      # invite
PATCH  /api/v1/workspaces/{id}/members/{mid}
DELETE /api/v1/workspaces/{id}/members/{mid}

# Store / brand kit
GET    /api/v1/workspaces/{id}/store
PATCH  /api/v1/workspaces/{id}/store

# Platforms / channels
GET    /api/v1/workspaces/{id}/platforms
POST   /api/v1/workspaces/{id}/platforms          # connect (ig oauth / rubika token / ...)
PATCH  /api/v1/workspaces/{id}/platforms/{pid}
DELETE /api/v1/workspaces/{id}/platforms/{pid}
POST   /api/v1/workspaces/{id}/platforms/{pid}/health
GET    /api/v1/instagram/oauth/start
GET    /api/v1/instagram/oauth/callback
GET    /api/v1/linkedin/oauth/start
GET    /api/v1/linkedin/oauth/callback

# Content
GET    /api/v1/workspaces/{id}/contents
POST   /api/v1/workspaces/{id}/contents
GET    /api/v1/workspaces/{id}/contents/{cid}
PATCH  /api/v1/workspaces/{id}/contents/{cid}
DELETE /api/v1/workspaces/{id}/contents/{cid}
POST   /api/v1/workspaces/{id}/contents/{cid}/submit        # for approval
POST   /api/v1/workspaces/{id}/contents/{cid}/approve
POST   /api/v1/workspaces/{id}/contents/{cid}/reject

# Publish jobs
POST   /api/v1/workspaces/{id}/publish-jobs           # create per-platform jobs from content
GET    /api/v1/workspaces/{id}/publish-jobs           # filter status/platform/campaign
POST   /api/v1/workspaces/{id}/publish-jobs/{jid}/retry
POST   /api/v1/workspaces/{id}/publish-jobs/{jid}/cancel
POST   /api/v1/workspaces/{id}/publish-jobs/{jid}/reassign

# Campaigns
GET    /api/v1/workspaces/{id}/campaigns
POST   /api/v1/workspaces/{id}/campaigns
GET    /api/v1/workspaces/{id}/campaigns/{campId}
PATCH  /api/v1/workspaces/{id}/campaigns/{campId}
POST   /api/v1/workspaces/{id}/campaigns/{campId}/clone

# Media
GET    /api/v1/workspaces/{id}/media
POST   /api/v1/workspaces/{id}/media           # upload
PATCH  /api/v1/workspaces/{id}/media/{mid}
DELETE /api/v1/workspaces/{id}/media/{mid}
POST   /api/v1/workspaces/{id}/media/{mid}/process   # crop/filter/text → variant

# Calendar
GET    /api/v1/workspaces/{id}/calendar?start=&end=&platform=

# Dashboard
GET    /api/v1/workspaces/{id}/dashboard/summary
GET    /api/v1/workspaces/{id}/dashboard/pulse
GET    /api/v1/workspaces/{id}/dashboard/action-center
GET    /api/v1/workspaces/{id}/dashboard/metrics?period=

# Analytics
GET    /api/v1/workspaces/{id}/analytics?metric=&period=&platform=&campaign=
GET    /api/v1/workspaces/{id}/analytics/logs           # publish_attempts
GET    /api/v1/workspaces/{id}/analytics/best-times

# Inbox (P2)
GET    /api/v1/workspaces/{id}/inbox?filter=
GET    /api/v1/workspaces/{id}/inbox/{threadId}
POST   /api/v1/workspaces/{id}/inbox/{threadId}/reply
POST   /api/v1/workspaces/{id}/inbox/{mid}/assign
POST   /api/v1/workspaces/{id}/inbox/{mid}/close
GET    /api/v1/workspaces/{id}/inbox/saved-replies
POST   /api/v1/workspaces/{id}/inbox/saved-replies

# Automation (P2)
GET    /api/v1/workspaces/{id}/automation/rules
POST   /api/v1/workspaces/{id}/automation/rules
PATCH  /api/v1/workspaces/{id}/automation/rules/{rid}
DELETE /api/v1/workspaces/{id}/automation/rules/{rid}
GET    /api/v1/workspaces/{id}/automation/events

# Webhooks (public, signed)
POST   /api/v1/webhooks/instagram
POST   /api/v1/webhooks/linkedin
GET    /api/v1/webhooks/instagram   # hub.challenge verify

# Notifications
GET    /api/v1/workspaces/{id}/notifications
POST   /api/v1/workspaces/{id}/notifications/{nid}/read

# Billing
GET    /api/v1/billing/plans
POST   /api/v1/billing/subscribe
GET    /api/v1/billing/invoices
GET    /api/v1/billing/portal
```

### 8.3 Webhook security
- Meta webhooks: verify `X-Hub-Signature-256` HMAC with app secret; idempotent by
  `external_id` on `inbox_messages`.
- All webhooks behind rate limiting + IP allowlist (Meta ranges) where feasible.

---

## 9. Security Architecture

- **Auth**: JWT (short-lived access + refresh) in `HttpOnly` + `Secure` + `SameSite=Lax`
  cookies; CSRF double-submit token for state-changing routes.
- **Password storage**: argon2id.
- **Secrets at rest**: OAuth/bot tokens encrypted with AES-256-GCM (key from env/KMS);
  never logged; redacted from API responses.
- **RBAC**: enforced via FastAPI dependencies on every route; no client-trusted UI gates.
- **Tenant isolation**: data-access layer injects `workspace_id` from the auth context;
  a unit test asserts cross-workspace reads return empty.
- **Input validation**: Pydantic v2 on all inputs; Zod on the frontend; strict
  allowlists for file uploads (mime + magic-byte check).
- **Rate limiting**: auth endpoints (5/15min/IP), webhooks (per-Meta), API
  (per-workspace token bucket).
- **Dependency security**: `npm audit`, `pip-audit`, Trivy image scan in CI.
- **Secrets in CI**: GitHub Actions secrets; no secrets in images.
- **Audit log**: security-relevant events to `audit_logs` (immutable, append-only).

---

## 10. Observability Architecture

- **Logs**: structured JSON (`trace_id`, `workspace_id`, `user_id`, `job_id`); shipped
  to a log aggregator; retention ≥ 90 days.
- **Metrics**: Prometheus exposition (`/metrics`); dashboards for publish-success rate,
  queue depth, adapter latency, API latency, error rate, circuit-breaker state.
- **Alerting**: Alertmanager → on-call; alerts on publish-success < 95%, queue-depth
  spike, circuit OPEN, auth-error spike, worker down.
- **Tracing**: OpenTelemetry; trace ID propagates frontend (header) → API → worker →
  adapter → channel API call (where supported).
- **Uptime**: status page (public) with component health.

---

## 11. Infrastructure & Deployment

- **Dev**: Docker Compose (the provided compose stack); `bun run dev` (frontend) +
  uvicorn + celery worker + beat + redis + postgres.
- **Staging**: containerized on a small VM/cluster; mirrors prod; seeded with test
  data; used for E2E + soak tests.
- **Prod**: containerized; Postgres managed (or HA pair); Redis HA; object storage
  (S3-compatible); Caddy edge; workers autoscaled on queue depth.
- **CI/CD**: GitHub Actions → build images → push to registry → deploy to staging on
  `main`; prod deploy on tag + manual approval.
- **Backups**: Postgres PITR every 15 min; nightly snapshot; restore drills monthly.
- **Iran-resident option (P3)**: deploy a parallel stack on Iran-resilient infra for
  Iran customers; data residency per workspace.

---

## 12. Scalability & Capacity

- **Targets (P3 GA)**: 10,000 workspaces, 100,000 jobs/day, 100 concurrent dashboard
  users on target infra.
- **Horizontal scaling**: stateless API + workers behind LB; Redis + Postgres as shared
  state. Workers autoscale on queue depth.
- **DB**: read replica for analytics + inbox reads; primary for writes; connection
  pooling (PgBouncer).
- **Hot paths**: dashboard summary cached (short TTL, invalidated on job state change);
  analytics snapshots pre-aggregated; media served via CDN/object storage.
- **Per-channel isolation**: independent queues + circuit breakers prevent one channel's
  outage from affecting others.

---

## 13. Resilience & Disaster Recovery

- **RPO**: 15 min (Postgres PITR). **RTO**: 1 h (restore + restart).
- **Worker crash**: `acks_late` + durable state machine → job resumes; no loss/dup
  (idempotency).
- **Redis loss**: broker messages may be lost; jobs in `pending`/`processing` are
  recovered by a reconciliation job that scans for stale `processing` and resets to
  `pending`.
- **Channel outage**: circuit breaker isolates; jobs queue + retry; UI surfaces status.
- **DB failover**: managed failover (or promoted replica); workers reconnect.
- **Backup restore drill**: monthly; documented runbook.

---

## 14. AI Integration Architecture

- **SDK**: `z-ai-web-dev-sdk` (server-side only, never client).
- **Use cases (P2)**: caption generation, hashtag suggestions, best-time, keyword
  expansion (for automation), idea generation (P3).
- **Pattern**: API route calls the SDK with a Persian system prompt conditioned on the
  workspace brand kit; returns structured JSON (variants array); cached per request.
- **Safety**: AI output is a *suggestion*; user edits before publish; `is_ai_generated`
  flag set on media where applicable (Meta compliance).
- **Cost control**: per-workspace daily AI quota; rate-limited.

---

## 15. Development Environment

- **Repo layout** (target):
  ```
  / (monorepo or polyrepo)
    frontend/            # Next.js 16 (the current src/ moves here)
    backend/             # FastAPI (the rubika-publisher backend)
      app/
        main.py
        routes/
        services/
        adapters/        # instagram, rubika, telegram, linkedin, eitaa
        worker.py
        models.py
      alembic/versions/
      tests/
    mini-services/
      realtime/          # socket.io, port 3003
    docs/                # this folder
    .github/workflows/
    docker-compose.yml
  ```
- **Local run**: `docker compose up -d --build`; frontend on 3000 (gateway 3100 in
  reference), backend on 8000, realtime on 3003.
- **Tooling**: `bun` (frontend), `uv`/pip (backend), `prisma` removed (Postgres +
  Alembic is source of truth); `playwright` for E2E.
- **Conventions**: Conventional Commits; PR template; 1 reviewer minimum; CI green to
  merge.

---

*End of technical architecture. Implementation detail beyond this lives in code + ADRs
(Architecture Decision Records) committed alongside the relevant change.*

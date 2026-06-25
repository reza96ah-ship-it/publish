# 03 — Product Backlog

> **Structure**: Epics → User Stories → Acceptance Criteria, sized on a modified
> Fibonacci scale (1, 2, 3, 5, 8, 13, 21) and prioritized by **MoSCoW** (MUST / SHOULD /
> NICE) and **phase** (P1 / P2 / P3 / P4+).
> **Phase mapping** is authoritative in [04_Roadmap.md](./04_ROADMAP.md); this backlog is
> the granular source.

## Conventions

- **Epic ID**: `E-<area>` (e.g., `E-AUTH`). **Story ID**: `S-<area>-<n>`.
- **As a / I want / so that** format for stories.
- **Acceptance Criteria (AC)** in Given/When/Then where useful, otherwise bullet checks.
- **Size** = engineering effort estimate (1 ≈ half-day, 21 ≈ 3+ weeks for one engineer).
- **Status**: `[PLANNED]` unless noted `[SHIPPED]` (prototype has it) or `[IN-PROGRESS]`.

## Backlog at a glance

| Epic | Area | Phase | Stories | Est. pts |
|------|------|-------|---------|----------|
| E-FOUND | Foundations (infra, DB, auth shell) | P1 | 9 | 34 |
| E-AUTH | Authentication & RBAC | P1–P2 | 8 | 21 |
| E-WS | Workspace & Brand Kit | P1 | 6 | 18 |
| E-CH | Channel Connections | P1–P2 | 10 | 29 |
| E-COMP | Compose Studio | P1 | 9 | 40 |
| E-CAL | Jalali Calendar & Queue | P1 | 7 | 26 |
| E-PUB | Publishing Worker & Resilience | P1 | 9 | 34 |
| E-MEDIA | Media Library & Editor | P1 | 7 | 25 |
| E-CONT | Content Library | P1 | 4 | 12 |
| E-CAMP | Campaigns | P1–P2 | 6 | 18 |
| E-DASH | Dashboard & Action Center | P1 | 6 | 21 |
| E-ANL | Analytics & Logs | P1–P3 | 7 | 23 |
| E-INBOX | Unified Inbox | P2 | 8 | 30 |
| E-APPR | Approval Workflows | P2 | 5 | 18 |
| E-AUTO | IG Comment-to-DM Automation | P2 | 7 | 26 |
| E-AI | AI Assistant (Persian) | P2 | 5 | 20 |
| E-NOTIF | Notifications & Realtime | P2 | 4 | 13 |
| E-BILL | Billing (IRR + local gateway) | P1 | 4 | 13 |
| E-A11Y | Accessibility & RTL hardening | P1–P3 | 4 | 13 |
| E-SCALE | Scale: Eitaa, listening, PWA, reports | P3+ | 7 | 30 |
| **Total** | | | **132** | **494** |

---

# Phase 1 — MVP (Multi-Channel Publishing Core)

## E-FOUND — Foundations

### S-FOUND-01 — Provision production PostgreSQL + Redis + Celery stack [MUST] · 5
**As** the engineering lead, **I want** the Docker Compose production stack
defined and running, **so that** all P1 work builds on real infra.
- AC: `docker compose up -d --build` brings up postgres, redis, backend (uvicorn),
  worker (celery), beat, frontend; health endpoints respond.
- AC: Alembic `upgrade head` runs clean against an empty DB.
- AC: `.env.example` documents every variable; `.env` is gitignored.

### S-FOUND-02 — Database schema consolidation (merge prototype + production) [MUST] · 8
**As** the backend engineer, **I want** one coherent PostgreSQL schema, **so that** the
prototype Prisma model and the FastAPI Alembic model are unified.
- AC: New Alembic migration `0004_unified_schema` creates `workspaces`,
  `workspace_members`, `platforms`, `campaigns`, `contents`, `content_platforms`,
  `publish_jobs`, `media`, `inbox_messages`, `analytics_snapshots`, `app_settings`,
  `automation_rules`, `automation_events`, `audit_logs` with FKs and indexes.
- AC: Existing `users`, `stores`, `rubika_accounts`, `posts`, `media_assets`,
  `publish_attempts` either migrated into or aliased to the unified model (with a
  data-migration script).
- AC: `alembic upgrade head` then `downgrade -1` then `upgrade head` all succeed in CI.

### S-FOUND-03 — Multi-tenant data-access layer [MUST] · 5
**As** the backend engineer, **I want** every tenant-scoped query scoped by
`workspace_id`, **so that** cross-tenant data leaks are impossible.
- AC: A repository/DAO layer enforces `workspace_id` filter on all reads/writes.
- AC: A test asserts a workspace cannot read another workspace's data (negative test).

### S-FOUND-04 — FastAPI app skeleton + middleware [MUST] · 3
**As** the backend engineer, **I want** the FastAPI app with CORS, auth, request-ID,
error-handling, and logging middleware, **so that** all routes share cross-cutting
concerns.
- AC: `/health` and `/health/db` respond; structured JSON logs with request IDs; global
  exception handler returns consistent error shape.

### S-FOUND-05 — Next.js 16 → FastAPI API client + TanStack Query wiring [MUST] · 3
**As** the frontend engineer, **I want** a typed API client and TanStack Query hooks,
**so that** the prototype stops using fixtures and reads from the backend.
- AC: `lib/api.ts` generated from OpenAPI (or hand-typed) with auth header injection.
- AC: Dashboard reads from `/api/dashboard/summary` etc.; fixtures removed.

### S-FOUND-06 — Design-token bridge & shared UI primitives [MUST] · 3
**As** the frontend engineer, **I want** the `--n-*` tokens and shadcn/ui confirmed as
the design system, **so that** all P1 UI is consistent.
- AC: `globals.css` tokens load in light + dark; a token-audit script (CI) flags
  hardcoded colors outside the documented exception.

### S-FOUND-07 — CI pipeline (lint, typecheck, test, build, migrate, audit) [MUST] · 3
**As** the engineering lead, **I want** CI gates, **so that** no broken code merges.
- AC: The provided `.github/workflows/ci.yml` runs frontend lint/typecheck/test/build +
  token audit + npm audit, and backend compile/migrate/import/test; all must pass.

### S-FOUND-08 — Jalali + Persian-digit utility library [MUST] · 2
**As** any engineer, **I want** shared utilities for Jalali conversion and Persian
digits, **so that** dates/numbers render consistently.
- AC: `lib/jalali.ts` (gregorian↔jalali, month/weekday names, holiday data) + tests.
- AC: `lib/persian.ts` (`toPersianDigits`, `normalizeDigits` for ۰-۹/٠-٩→0-9) + tests.

### S-FOUND-09 — Observability baseline (logs, metrics, tracing) [SHOULD] · 2
**As** the SRE, **I want** structured logs + Prometheus metrics + trace IDs, **so that**
production is observable.
- AC: JSON logs with trace IDs; `/metrics` endpoint exposes publish-success, queue-depth,
  API-latency; trace ID propagates frontend→API→worker.

---

## E-AUTH — Authentication & RBAC (P1 core; P2 RBAC depth)

### S-AUTH-01 — Admin registration & login [MUST] · 3
**As** an admin, **I want** to register and log in, **so that** I access my workspace.
- AC: Register (email/password, hashed with bcrypt/argon2), login → JWT session cookie;
  `/api/auth/me` returns the user + workspace.
- AC: Rate-limited (5 failed attempts → 15-min lock).

### S-AUTH-02 — Password reset (email token) [MUST] · 2
- AC: Request reset → emailed token (15-min expiry) → set new password; old sessions
  invalidated.

### S-AUTH-03 — Session management & "remember me" [SHOULD] · 2
- AC: Sliding session; "remember me" extends to 30d; idle timeout 1h without remember.

### S-AUTH-04 — Workspace membership model [MUST] · 2
- AC: `workspace_members` with role; a user can belong to multiple workspaces;
  workspace switcher in the UI.

### S-AUTH-05 — RBAC enforcement (Admin/Editor/Approver/Viewer) [MUST·P2] · 5
- AC: Server-side decorator/dependency checks role per route; e.g., only Admin can
  invite/remove, only Admin/Approver can approve, Editor can create but not publish.
- AC: UI hides actions the user can't perform.

### S-AUTH-06 — Invite members by email [SHOULD·P2] · 3
- AC: Admin invites → email with accept link → on accept, member added with chosen role.

### S-AUTH-07 — Auth audit log [SHOULD·P2] · 2
- AC: Log login/logout/failed/role-change/token-connect/disconnect to `audit_logs`;
  viewable in Settings (admin).

### S-AUTH-08 — 2FA (TOTP) for admins [NICE·P3] · 2
- AC: Admin can enable TOTP; login requires second factor.

---

## E-WS — Workspace & Brand Kit

### S-WS-01 — Workspace/store profile CRUD [MUST] · 3
- AC: Settings page edits name, category, phone, description, timezone (default
  Asia/Tehran); persisted to `workspaces`/`stores`.

### S-WS-02 — Brand kit (colors, voice, CTA, hashtags, footer, guidelines) [MUST] · 4
- AC: Brand kit form persists primary color, accent color, brand voice, default CTA,
  content guidelines, default hashtags, caption footer.
- AC: Logo + avatar upload (stored in media library, referenced by asset id).

### S-WS-03 — Brand kit consumption in Compose [MUST] · 3
- AC: Compose auto-appends default hashtags + caption footer (toggle); AI assistant
  conditions on brand voice.

### S-WS-04 — Timezone & locale settings [MUST] · 2
- AC: Workspace timezone drives all scheduled times; Persian-digits toggle.

### S-WS-05 — Workspace switcher (multi-workspace users) [SHOULD·P2] · 3
- AC: Header dropdown switches active workspace; data re-fetches.

### S-WS-06 — Workspace data export (CSV) [SHOULD·P3] · 3
- AC: Admin exports content, media metadata, analytics as CSV/ZIP.

---

## E-CH — Channel Connections

### S-CH-01 — Channel hub UI (list, status, actions) [MUST] · 3
- AC: Lists connected accounts per platform with status, last success, last error,
  token expiry; disconnect/reconnect/health-check actions.

### S-CH-02 — Instagram OAuth connect (professional account) [MUST] · 5
- AC: OAuth flow via Meta; long-lived token stored encrypted; account type detected
  (professional vs personal); pages/IG accounts selectable.

### S-CH-03 — Instagram personal-account reminder mode [MUST] · 3
- AC: Personal accounts show "reminder/manual mode" badge; scheduling creates a
  reminder (notification + copy-ready caption/media) instead of an API publish.

### S-CH-04 — Rubika bot connect + health check [MUST] · 3
- AC: Add bot_token + chat_id; "test connection" sends a test message; status reflects
  result; `اختلال API` surfaced on failure.

### S-CH-05 — Telegram bot connect + channel-admin check [MUST·P2] · 3
- AC: Add bot_token; verify bot is admin of target channel; health check.

### S-CH-06 — LinkedIn OAuth connect [MUST·P2] · 3
- AC: OAuth; member + optional company page; token refresh.

### S-CH-07 — Token expiry warnings [MUST] · 2
- AC: Tokens expiring ≤ 7 days surface in Action Center + email (configurable).

### S-CH-08 — Channel adapter interface + Instagram adapter [MUST] · 5
- AC: `ChannelAdapter` interface (health, readiness, publish, refresh, fetch_inbox,
  reply); Instagram adapter implements two-step publish (image, carousel, Reels) +
  `/content_publishing_limit` backpressure + `is_ai_generated` flag.

### S-CH-09 — Rubika adapter [MUST] · 3
- AC: Implements interface; maps content→Rubika message (text/photo/video/document +
  inline keyboard CTA); retry/backoff on 5xx/429.

### S-CH-10 — Telegram + LinkedIn adapters [MUST·P2] · 4
- AC: Both implement the interface; TG supports sendMessage/sendPhoto/sendMediaGroup +
  markdown; LI supports text/image/article/video share.

---

## E-COMP — Compose Studio

### S-COMP-01 — Multi-step composer shell (Content→Media→Platforms→Schedule) [MUST] · 5
- AC: Step rail + validated transitions; persists draft to `contents`/`publish_jobs`.

### S-COMP-02 — Content step (caption bidi editor, hashtags, note, campaign) [MUST] · 5
- AC: Rich text editor with correct bidi cursor/selection; hashtag manager; internal
  note; campaign selector; character counter per platform.

### S-COMP-03 — Media step (upload/pick, multi-asset, per-platform crop) [MUST] · 5
- AC: Upload from device or pick from library; reorder; per-platform aspect-ratio crop
  (1:1, 4:5, 9:16, 16:9, 1.91:1); alt text.

### S-COMP-04 — Platforms step (multi-select + per-channel adaptation) [MUST] · 5
- AC: Select channels; per-channel override of caption/hashtags/CTA; readiness check
  per channel (length, media specs, token validity).

### S-COMP-05 — Schedule step (now / schedule-at / queue) [MUST] · 4
- AC: Jalali datetime picker; "add to queue" uses best-time slot; timezone from
  workspace; conflict detection.

### S-COMP-06 — Live preview per platform (pixel mock) [MUST] · 5
- AC: IG feed/story, TG channel post, Rubika message, LI share mocks render the actual
  content+media; updates live as you edit.

### S-COMP-07 — Readiness check (blocking issues surfaced) [MUST] · 3
- AC: Validates caption length per platform, media specs, token validity, hashtag count;
  blocks publish with actionable errors.

### S-COMP-08 — Save as draft / duplicate / assign [MUST] · 3
- AC: Drafts saved; duplicate creates a copy; assignee selectable (Admin/Editor).

### S-COMP-09 — Submit for approval (P2) [MUST·P2] · 5
- AC: "Submit for approval" routes to workspace approvers; locks edits; notifiers fire.

---

## E-CAL — Jalali Calendar & Queue

### S-CAL-01 — Jalali month view with posts [MUST] · 5
- AC: Renders Jalali months, Persian weekday names (شنبه…جمعه), Iranian holidays
  overlaid, Sat–Wed work-week shading; posts as color-coded chips; multi-post day
  popover.

### S-CAL-02 — Week & Day views [MUST] · 3
- AC: Week view (7 columns, Sat-first); day view (timeline); both Jalali.

### S-CAL-03 — Drag-and-drop reschedule [MUST] · 4
- AC: Drag a post to another slot; confirms; updates `publish_jobs.scheduled_at`;
  respects queue & readiness.

### S-CAL-04 — Per-channel swimlane toggle [MUST] · 3
- AC: Toggle one channel or "all channels"; chips filter accordingly.

### S-CAL-05 — Quick-create on empty slot [MUST] · 2
- AC: Click empty slot → Compose opens prefilled with that date/time/channel.

### S-CAL-06 — Agenda (list) view [SHOULD] · 2
- AC: Accessible list of upcoming posts; screen-reader friendly.

### S-CAL-07 — Queue sub-tab (pending jobs, retry, cancel, reassign) [MUST] · 4
- AC: Lists pending/processing/failed jobs with status; retry/cancel/reassign actions;
  filters by status/channel/campaign.

### S-CAL-08 — Best-time suggestions (AI) [SHOULD·P2] · 3
- AC: "Suggest time" proposes optimal slot per channel based on audience active hours +
  historical engagement.

---

## E-PUB — Publishing Worker & Resilience

### S-PUB-01 — Celery queue per channel adapter [MUST] · 3
- AC: Separate queue per channel; routing key per platform; no head-of-line blocking.

### S-PUB-02 — Publish job state machine (durable) [MUST] · 4
- AC: `pending → processing → live → success | failed | action` persisted before API
  call; resume after worker crash picks correct state.

### S-PUB-03 — Idempotency keys [MUST] · 3
- AC: Each job has `idempotency_key`; adapter checks "already published?" before retry;
  no double-publish on retry.

### S-PUB-04 — Retry with exponential backoff + jitter [MUST] · 3
- AC: Transient failures retry (1s,2s,4s,8s,16s cap 5min, ±20% jitter); max attempts
  configurable per channel.

### S-PUB-05 — Circuit breaker per channel [MUST] · 4
- AC: N consecutive failures (e.g., 5) trips breaker → channel marked `error` → Action
  Center notified → health check before resume.

### S-PUB-06 — Dead-letter queue + manual retry/discard [MUST] · 3
- AC: Exhausted jobs → DLQ; UI lists them with last error; retry/discard actions.

### S-PUB-07 — Publish-attempt audit log [MUST] · 3
- AC: Every attempt records request/response payload, error, started_at/finished_at in
  `publish_attempts`; viewable in Analytics → Logs.

### S-PUB-08 — Beat scheduler dispatches due jobs [MUST] · 3
- AC: Celery beat dispatches jobs whose `scheduled_at ≤ now`; target attempt within
  30s (median), P95 ≤ 2min.

### S-PUB-09 — Scheduled-time accuracy + queue-depth metrics [MUST] · 2
- AC: Metric `publish_lag_seconds` tracked; queue depth per channel tracked; alert if
  lag P95 > 2min or depth > threshold.

### S-PUB-10 — Realtime job status via WebSocket [SHOULD·P2] · 5
- AC: Dashboard/Queue update live as jobs transition (socket.io mini-service).

---

## E-MEDIA — Media Library & Editor

### S-MEDIA-01 — Upload + storage (image/video) with metadata [MUST] · 4
- AC: Drag-drop/upload; Sharp processes images (variants, thumbnails); ffmpeg extracts
  video thumbnail; metadata stored in `media`.

### S-MEDIA-02 — Folder + tag organization [MUST] · 3
- AC: Folders (default عمومی), tags, search, filter; grid + list views.

### S-MEDIA-03 — Persian-first image editor [MUST] · 8
- AC: Crop (1:1, 4:5, 9:16, 16:9, 1.91:1), rotate, filters, **text overlay in Vazirmatn
  (RTL)**, stickers/shapes; undo/redo; exports per-platform variant.

### S-MEDIA-04 — Reuse media in Compose [MUST] · 2
- AC: Compose media picker pulls from library; inserts with stored crops.

### S-MEDIA-05 — Storage quota per plan [MUST] · 2
- AC: Quota indicator; upload blocked over quota with upgrade prompt.

### S-MEDIA-06 — Platform-spec enforcement (size/resolution/duration) [MUST] · 3
- AC: Per-platform validation (e.g., IG image ≤ 8MB, video ≤ 100MB/60s for feed);
  surfaced in readiness check.

### S-MEDIA-07 — Video trim + thumbnail select [SHOULD·P3] · 3
- AC: Basic trim + thumbnail pick in the editor.

---

## E-CONT — Content Library

### S-CONT-01 — Content items with lifecycle [MUST] · 3
- AC: Reusable items (title, body, hashtags, note) with status
  draft→review→approved→scheduled→published→failed; list/grid.

### S-CONT-02 — Search + filter [MUST] · 3
- AC: Full-text search; filter by status/campaign/platform/tag; sort by date.

### S-CONT-03 — Create from scratch / save from composed post [MUST] · 3
- AC: New item form; "save as content" action in Compose.

### S-CONT-04 — Duplicate + bulk actions [SHOULD] · 3
- AC: Duplicate item; bulk tag/archive/delete.

---

## E-CAMP — Campaigns

### S-CAMP-01 — Campaign portfolio list [MUST] · 3
- AC: List with health label/color, owner, progress, goal completion, days remaining,
  top blocker; filter by status.

### S-CAMP-02 — Campaign create/edit [MUST] · 3
- AC: Name, description, status, start/end (Jalali), goal type & value, owner; health
  label auto-derived (or manual override).

### S-CAMP-03 — Campaign command center (Overview/Calendar/Posts/Media/Report) [MUST] · 5
- AC: Tabs render the four sub-views scoped to the campaign.

### S-CAMP-04 — Attach posts to campaign [MUST] · 2
- AC: Compose campaign selector assigns post; campaign Posts tab lists them.

### S-CAMP-05 — Campaign-scoped report [SHOULD·P2] · 3
- AC: Reach/engagement/conversions vs goal; exportable.

### S-CAMP-06 — Archive / duplicate / clone-with-new-dates [SHOULD] · 2
- AC: Archive (soft delete from active list); duplicate; clone shifts all dates by a
  chosen offset.

---

## E-DASH — Dashboard & Action Center

### S-DASH-01 — Operational summary [MUST] · 3
- AC: Health, posts today, queued, failed, pending approval, inbox unread, SLA risk —
  all from backend (no fixtures).

### S-DASH-02 — Publishing pulse (live jobs) [MUST] · 4
- AC: Live list of processing/queued/action jobs with progress, assignee, campaign,
  platform; reads from `publish_jobs`.

### S-DASH-03 — Action center [MUST] · 4
- AC: Surfaces failed publishes, expiring tokens, SLA-risk messages, disconnected
  channels; one-tap action (retry, reconnect, reply).

### S-DASH-04 — Executive metrics (engagement/reach/audience/campaigns) [MUST] · 4
- AC: Period-comparison sparklines; Persian digits; Jalali axis; period filter.

### S-DASH-05 — Campaign health panel [MUST] · 3
- AC: Per-campaign progress, goal, days, blocker, health color.

### S-DASH-06 — Platform status panel [MUST] · 3
- AC: Per-channel state, accounts, last success, primary issue.

---

## E-ANL — Analytics & Logs

### S-ANL-01 — Metrics taxonomy endpoints [MUST] · 4
- AC: `/api/analytics/{metric}` for reach/impressions/engagement/followers/clicks/
  conversions/publish-success/response-time; period + channel + campaign filters.

### S-ANL-02 — Analytics dashboard (charts) [MUST] · 4
- AC: Recharts time-series; period selector; per-platform + per-campaign breakdown;
  Persian digits + Jalali axis.

### S-ANL-03 — Analytics data ingestion (channel insights) [SHOULD·P2] · 5
- AC: Nightly job pulls IG/LinkedIn insights into `analytics_snapshots`; backfill on
  connect.

### S-ANL-04 — Logs sub-tab (publishing audit) [MUST] · 3
- AC: `publish_attempts` viewer with filter (status/date/channel) + CSV export.

### S-ANL-05 — Best-time heatmap per channel [SHOULD·P2] · 3
- AC: Heatmap of audience active hours from insights + historical engagement.

### S-ANL-06 — Exportable PDF/CSV reports + scheduled email [SHOULD·P3] · 3
- AC: Generate PDF (ReportLab) / CSV; schedule weekly email.

### S-ANL-07 — Competitor benchmarking / share of voice [NICE·P4+] · 1 (research)
- AC: Research spike; listening pipeline design.

---

## E-BILL — Billing (IRR + local gateway)

### S-BILL-01 — Plan tiers (Free / Pro / Agency / Enterprise) [MUST] · 2
- AC: Define tiers with seat/channel/storage limits; plan stored on workspace.

### S-BILL-02 — Local payment gateway (Zarinpal) integration [MUST] · 5
- AC: Subscribe → redirect to gateway → callback → activate/extend plan; invoice
  record; retry on failed callback.

### S-BILL-03 — Quota enforcement [MUST] · 3
- AC: Channels/seats/storage/posts-per-day enforced per plan; upgrade prompts.

### S-BILL-04 — Invoice history + plan management [MUST] · 3
- AC: Settings → Billing: current plan, invoices, change/cancel plan.

---

# Phase 2 — Collaboration & Engagement

## E-INBOX — Unified Inbox

### S-INBOX-01 — Unified stream (comments + DMs + mentions) [MUST·P2] · 5
- AC: Aggregated from IG (webhooks), TG (getUpdates/polling), Rubika, LI; filter by
  channel/type/status/assignee; pagination.

### S-INBOX-02 — Thread view + inline reply [MUST·P2] · 4
- AC: Open a conversation; reply inline → publishes to source via adapter's `reply`.

### S-INBOX-03 — Assign + SLA timers [MUST·P2] · 4
- AC: Assign to member; first-response + resolution SLA timers; escalation on breach.

### S-INBOX-04 — Saved replies (snippets) with variables [MUST·P2] · 3
- AC: Snippet library with {name}/{username} variables; insert in reply.

### S-INBOX-05 — Auto-tagging rules [SHOULD·P2] · 3
- AC: Keyword→tag rules; applied on ingest.

### S-INBOX-06 — Automation events log [MUST·P2] · 3
- AC: Log of comment-to-DM triggers, DMs sent, policy-window status; viewable in inbox.

### S-INBOX-07 — Mark read/unread, archive, close [MUST·P2] · 2
- AC: Standard mailbox actions; bulk select.

### S-INBOX-08 — Response-time analytics [SHOULD·P2] · 3
- AC: Median first-response + resolution by channel/agent; in Analytics.

### S-INBOX-09 — Webhook ingestion (IG comments/messages/mentions) [MUST·P2] · 3
- AC: Meta webhook subscription + verification + signature check; idempotent ingest to
  `inbox_messages`.

---

## E-APPR — Approval Workflows

### S-APPR-01 — Single-level approval flow [MUST·P2] · 4
- AC: Draft → Submit → Approve/Reject (with comment) → Schedule; status tracked on
  `contents.status`.

### S-APPR-02 — Approver routing + notifications [MUST·P2] · 3
- AC: All workspace Approvers notified on submit; creator notified on decision.

### S-APPR-03 — Lock/unlock on approval [MUST·P2] · 2
- AC: Approved content locked from edits unless an Admin/Approver unlocks.

### S-APPR-04 — Multi-level approvals (Planable-style, in-context comments) [SHOULD·P3] · 6
- AC: Configurable approval chains; reviewers leave comments pinned to the post mock;
  statuses per level.

### S-APPR-05 — Approval analytics (throughput, bottlenecks) [NICE·P3] · 3
- AC: Time-in-each-state; rejection reasons; in Analytics.

---

## E-AUTO — Instagram Comment-to-DM Automation

### S-AUTO-01 — Automation rule CRUD [MUST·P2] · 3
- AC: Create/edit/delete rules (trigger type/value, target scope, DM message/media,
  enabled) in Inbox → Automation tab.

### S-AUTO-02 — Comment webhook → rule evaluation [MUST·P2] · 4
- AC: On IG comment webhook, evaluate enabled rules; Persian/Arabic-Indic digit
  normalization before match.

### S-AUTO-03 — DM send within 24h window [MUST·P2] · 4
- AC: Match → enqueue DM task → send via Messaging API within window; log to
  `automation_events` with policy_window_expires_at.

### S-AUTO-04 — Window-expired handling [MUST·P2] · 2
- AC: If outside 24h, log `skipped_window_expired`; surface in inbox for manual reply.

### S-AUTO-05 — HUMAN_AGENT tag for support follow-up [SHOULD·P2] · 3
- AC: Optional support-mode rule uses HUMAN_AGENT tag (7-day window); never for
  promotional content; audited.

### S-AUTO-06 — Opt-out (stop/توقف) [MUST·P2] · 2
- AC: User replies stop/توقف → suppress future automated DMs (per-rule or global);
  logged.

### S-AUTO-07 — Personal-account disabled state [MUST·P2] · 2
- AC: Personal accounts: automation disabled; triggering comments surface in inbox for
  manual reply.

### S-AUTO-08 — Pre-seeded Persian commerce keyword set [SHOULD·P2] · 1
- AC: Seed triggers: کد, قیمت, لینک, خرید, ثبت‌نام, آدرس.

---

## E-AI — AI Assistant (Persian)

### S-AI-01 — Persian caption generation (brand-voice) [MUST·P2] · 5
- AC: In Compose, "تولید با هوش مصنوعی" generates 3 caption variants conditioned on
  topic + brand voice + default hashtags; z-ai-web-dev-sdk server-side.

### S-AI-02 — Hashtag suggestions (Persian-relevant) [SHOULD·P2] · 3
- AC: Suggest hashtags from caption + trending relevance; insert into editor.

### S-AI-03 — Best-time suggestion per channel [SHOULD·P2] · 3
- AC: From insights + historical engagement, propose slots.

### S-AI-04 — Content repurposing (long→thread/blog→caption) [NICE·P3] · 4
- AC: Repurpose a long post into a thread or a caption summary.

### S-AI-05 — Idea generation (weekly content ideas) [NICE·P3] · 3
- AC: "Ideas for this week" based on trends + brand voice + history.

### S-AI-06 — Comment keyword expansion (for automation) [SHOULD·P2] · 2
- AC: Given a base trigger, suggest related Persian keywords.

---

## E-NOTIF — Notifications & Realtime

### S-NOTIF-01 — In-app notification center [MUST·P2] · 3
- AC: Bell + unread badge; list of events; mark read.

### S-NOTIF-02 — Notification event types [MUST·P2] · 2
- AC: publish success/failed, approval requested/approved/rejected, inbox new message,
  token expiring, channel disconnected, automation event.

### S-NOTIF-03 — Email notifications (configurable) [SHOULD·P2] · 3
- AC: Settings → notification preferences per event type.

### S-NOTIF-04 — Realtime WebSocket push [SHOULD·P2] · 5
- AC: socket.io mini-service; frontend subscribes; live updates on dashboard/inbox/queue.

---

## E-A11Y — Accessibility & RTL Hardening

### S-A11Y-01 — RTL audit + fixes (all P1 views) [MUST] · 3
- AC: No LTR bleed; correct mirroring; focus order; bidi text in composer.

### S-A11Y-02 — Keyboard navigation + ARIA [MUST] · 4
- AC: All interactive elements reachable; ARIA roles/labels; visible focus.

### S-A11Y-03 — Color contrast AA [MUST] · 2
- AC: Audit + fix all token combinations to ≥ 4.5:1 (3:1 large text).

### S-A11Y-04 — Screen-reader test (NVDA/VoiceOver) [SHOULD·P2] · 4
- AC: Key flows announced correctly; fix issues.

---

# Phase 3 — Scale (selection; full list in E-SCALE)

### S-SCALE-01 — Eitaa adapter [MUST·P3] · 5
### S-SCALE-02 — Multi-level approvals (in-context comments) [SHOULD·P3] · 6
### S-SCALE-03 — Advanced analytics + scheduled PDF reports [SHOULD·P3] · 5
### S-SCALE-04 — Social listening foundations (mentions, keywords) [SHOULD·P3] · 8
### S-SCALE-05 — PWA + offline-tolerant compose [SHOULD·P3] · 5
### S-SCALE-06 — SSO (SAML/OIDC) for enterprise [NICE·P3] · 3 (research spike)
### S-SCALE-07 — Iran-resident hosting option [NICE·P3] · 2 (ops)

---

## Prioritization rationale

- **P1 MUST** stories are the irreducible launch set: a team can connect channels,
  compose, schedule, publish (resiliently), and see a real dashboard + analytics.
- **P2 MUST** stories make it a *team* tool (inbox, approvals, automation, AI, RBAC).
- **P3 SHOULD** stories scale it (Eitaa, listening, PWA, reports, SSO).
- **NICE** items are backlog for opportunity-based scheduling.

## Velocity assumption

At ~7 engineers and an assumed blended velocity of ~60 points/sprint (2-week sprints),
the ~494-point backlog is ~8 sprints (~16 weeks) of feature work, plus hardening —
aligning with the 4-phase roadmap in [04_Roadmap.md](./04_ROADMAP.md).

---

*End of backlog. Each story will carry a dedicated task in the project tracker with
linked PRs, E2E specs, and design links once execution begins.*

# 02 — Request for Proposal (RFP)

**Project**: Nashrino (نشرینو) SocialOps Studio — Persian-first multi-channel social
operations platform
**Document version**: 1.0
**Owner**: Product — Nashrino
**Status**: `[PLANNED]` — issued for vendor / engineering response

---

## Table of Contents

1. [Purpose & Scope of this RFP](#1-purpose--scope-of-this-rfp)
2. [Background & Context](#2-background--context)
3. [Project Objectives & Success Criteria](#3-project-objectives--success-criteria)
4. [Scope of Work — In Scope](#4-scope-of-work--in-scope)
5. [Scope of Work — Out of Scope](#5-scope-of-work--out-of-scope)
6. [Functional Requirements (FR)](#6-functional-requirements-fr)
7. [Non-Functional Requirements (NFR)](#7-non-functional-requirements-nfr)
8. [Channel Integration Requirements](#8-channel-integration-requirements)
9. [Data Model Requirements](#9-data-model-requirements)
10. [Security, Privacy & Compliance Requirements](#10-security-privacy--compliance-requirements)
11. [Instagram Comment-to-DM Automation — Detailed Spec](#11-instagram-comment-to-dm-automation--detailed-spec)
12. [Design & UX Requirements](#12-design--ux-requirements)
13. [Deliverables & Milestones](#13-deliverables--milestones)
14. [Technical Constraints & Stack](#14-technical-constraints--stack)
15. [Acceptance Criteria & Definition of Done](#15-acceptance-criteria--definition-of-done)
16. [Vendor Evaluation Criteria](#16-vendor-evaluation-criteria)
17. [Response Format & Submission](#17-response-format--submission)
18. [Terms, Assumptions & Risks](#18-terms-assumptions--risks)

---

## 1. Purpose & Scope of this RFP

This RFP solicits proposals to design, build, test, and deliver the **Nashrino SocialOps
Studio** — a production-grade, multi-tenant web application for planning, composing,
scheduling, publishing, engaging, and analyzing social media content across **Rubika,
Instagram, Telegram, and LinkedIn** (with Eitaa and others on the roadmap).

The selected vendor / engineering team will be responsible for:
1. Building the production frontend (Next.js 16) and backend (FastAPI) against the
   requirements herein.
2. Implementing channel adapters with resilient publish workers.
3. Delivering the Persian-first, RTL-native, Jalali-native UX.
4. Shipping an automated E2E test suite and CI pipeline.

This RFP references the companion documents:
- [01_BENCHMARK_ANALYSIS.md](./01_BENCHMARK_ANALYSIS.md) — competitive context.
- [03_PRODUCT_BACKLOG.md](./03_PRODUCT_BACKLOG.md) — the granular work items.
- [04_ROADMAP.md](./04_ROADMAP.md) — phased delivery sequence.
- [05_TECHNICAL_ARCHITECTURE.md](./05_TECHNICAL_ARCHITECTURE.md) — system design.
- [06_DESIGN_SYSTEM.md](./06_DESIGN_SYSTEM.md) — design tokens & components.

## 2. Background & Context

Nashrino began as a Rubika publisher MVP. The product direction is now a multi-channel
SocialOps platform inspired by the workflow maturity of Buffer, Hootsuite, Sprout
Social, and Later, but purpose-built for Persian commerce and content teams.

**Existing assets (provided to the vendor):**
- A **Next.js 16 prototype workspace** (`src/`) implementing the UX shell and 11 views
  against fixture data — validates the design direction. (Vazirmatn font, Tailwind 4,
  shadcn/ui, dark/light, full RTL.)
- A **FastAPI backend reference** with Alembic migrations defining the production
  schema (`users`, `stores`, `rubika_accounts`, `posts`, `media_assets`,
  `publish_attempts`) plus the brand-kit migration.
- This document set as the canonical specification.

**The gap to close:** the prototype frontend talks to fixtures; the FastAPI backend is
partial. The vendor must bring both to production, connect them, and deliver the
channel adapters, workers, and missing features per the roadmap.

## 3. Project Objectives & Success Criteria

### 3.1 Objectives
1. Deliver a **production** multi-tenant SaaS where a workspace can connect channels,
   compose, schedule, publish, engage, and analyze — in Persian, RTL, Jalali.
2. Achieve a **publish success rate ≥ 98%** and **P95 scheduled-time accuracy ≤ 2 min**.
3. Ship the **Instagram comment-to-DM automation** engine, compliant with Meta policy.
4. Match or exceed the UX maturity of Buffer/Loomly for the in-scope features, while
   being the only tool with correct RTL + Jalali + Rubika.
5. Launch with IRR pricing and local payment-gateway integration.

### 3.2 Success Criteria (measurable)
- All Phase 1–2 acceptance criteria in [04_Roadmap](./04_ROADMAP.md) pass.
- E2E test suite (Playwright) covers the golden paths and passes in CI.
- Lighthouse mobile score ≥ 90 on the dashboard route (4G profile, Iran network).
- Zero critical security findings in a third-party review.
- 30-day post-launch: WAW ≥ 200, publish success rate ≥ 98%, NPS ≥ 30.

## 4. Scope of Work — In Scope

The vendor shall deliver, per the phased roadmap:

**Phase 1 (MVP — multi-channel publishing core)**
- Multi-tenant auth (admin + workspace), brand-kit store profile.
- Channel hub: Instagram (OAuth, professional-account publish flow), Rubika (bot token),
  Telegram (bot token), LinkedIn (OAuth).
- Multi-step Compose (content → media → platforms → schedule) with per-channel live
  preview.
- Jalali calendar (month/week/day) with drag-to-reschedule and queue sub-tab.
- Resilient publish worker (per-channel queue, idempotent, retry+backoff, circuit
  breaker, DLQ, audit log).
- Dashboard (operational summary, publishing pulse, action center, metrics, campaign
  health, platform status).
- Media library (folders, tags, upload, Persian-first image editor).
- Content library (lifecycle, search).
- Analytics foundations (reach, engagement, audience, per-channel/per-campaign).
- Settings (brand kit, team members, roles).

**Phase 2 (Collaboration & Engagement)**
- Unified inbox (comments + DMs + mentions) with routing, saved replies, SLA tracking.
- Approval workflows (single-level submit → approve/reject → schedule, with comments).
- Roles & permissions (Admin / Editor / Approver / Viewer).
- Campaign command center (portfolio, overview, calendar, posts, media, report).
- Instagram comment-to-DM automation engine (compliant).
- AI assistant (Persian caption generation, hashtags, best-time).

**Phase 3 (Scale)**
- Eitaa channel adapter.
- Multi-level approvals (Planable-style, in-context comments).
- Advanced analytics (benchmarks, exportable PDF/CSV reports, scheduled reports).
- Social listening foundations (mentions, keyword tracking).
- Mobile-responsive refinements + PWA.

**Phase 4+ (Expand)** — out of immediate RFP scope but architecture must allow:
- Listening, sentiment, share-of-voice.
- E-commerce / revenue attribution.
- Additional channels (X, Threads, YouTube Shorts).
- Mobile native apps.

## 5. Scope of Work — Out of Scope

- Native mobile apps (iOS/Android) — Phase 4+. Mobile-responsive web is in scope.
- Social listening / sentiment / share-of-voice — Phase 4+.
- Revenue attribution / e-commerce platform integrations — Phase 4+.
- A full Canva-equivalent design editor — Nashrino ships a focused Persian-first image
  editor only.
- Public API / developer platform for third parties — Phase 4+.
- SSO (SAML/OIDC) for enterprise — Phase 3+ (basic role-based auth in scope Phases 1–2).

## 6. Functional Requirements (FR)

Requirements are grouped by navigational area. Each FR has an ID (`FR-<area>-<n>`),
priority (`MUST` / `SHOULD` / `NICE`), and maps to backlog epics in
[03_PRODUCT_BACKLOG.md](./03_PRODUCT_BACKLOG.md). The phase in which each is delivered
is in [04_Roadmap.md](./04_ROADMAP.md).

### 6.1 Authentication & Workspace (FR-AUTH)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AUTH-01 | Admin login (email + password) with secure session management. | MUST |
| FR-AUTH-02 | Multi-tenant workspace model: a workspace owns all its channels, content, media, campaigns, jobs, inbox, analytics. | MUST |
| FR-AUTH-03 | Workspace members with roles: Admin, Editor, Approver, Viewer (RBAC enforced server-side). | MUST (P2) |
| FR-AUTH-04 | Invite members by email; accept-flow with role assignment. | SHOULD (P2) |
| FR-AUTH-05 | Password reset flow (email-token, expiry). | MUST |
| FR-AUTH-06 | Session timeout & "remember me" (configurable). | SHOULD |
| FR-AUTH-07 | Audit log of auth events (login, logout, failed login, role change). | SHOULD (P2) |
| FR-AUTH-08 | Optional 2FA (TOTP) for admins. | NICE (P3) |

### 6.2 Dashboard (FR-DASH)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DASH-01 | Operational summary: overall health, posts today, queued, failed, pending approval, inbox unread, response SLA risk. | MUST |
| FR-DASH-02 | Publishing pulse: live list of jobs in processing/queued/action-needed with progress, assignee, campaign, platform. | MUST |
| FR-DASH-03 | Action center: surfaced critical items (failed publishes, expiring tokens, SLA-risk messages, disconnected channels) with one-tap action. | MUST |
| FR-DASH-04 | Executive metrics: engagement, reach, audience growth, active campaigns — with sparklines and period comparison. | MUST |
| FR-DASH-05 | Campaign health panel: per-campaign progress, goal completion, days remaining, top blocker, health label/color. | MUST |
| FR-DASH-06 | Platform status panel: per-channel connection state, accounts, last success, primary issue. | MUST |
| FR-DASH-07 | Period filter (7d / 30d / 90d) applied to metrics. | MUST |
| FR-DASH-08 | Real-time updates via WebSocket for job status changes (no manual refresh). | SHOULD |
| FR-DASH-09 | Personalizable widget arrangement (drag) — NICE. | NICE (P3) |

### 6.3 Compose (FR-COMP)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-COMP-01 | Multi-step composer: Content → Media → Platforms → Schedule. | MUST |
| FR-COMP-02 | Content step: title, caption (rich, bidi-safe), hashtags, internal note, campaign selector. | MUST |
| FR-COMP-03 | Media step: upload from device or pick from media library; multi-asset; per-platform crop/aspect-ratio enforcement. | MUST |
| FR-COMP-04 | Platforms step: multi-select channels; per-channel caption adaptation (override text, hashtags, CTA per channel). | MUST |
| FR-COMP-05 | Schedule step: choose "Post now", "Schedule at" (Jalali date+time picker), or "Add to queue". | MUST |
| FR-COMP-06 | Live preview per selected platform (pixel-accurate mock: IG feed, IG story, TG channel post, Rubika message, LI share). | MUST |
| FR-COMP-07 | Readiness check: validates caption length per platform, media specs, token validity, hashtag limits; surfaces blocking issues. | MUST |
| FR-COMP-08 | Save as draft / duplicate / schedule-on-behalf-of (assignee). | MUST |
| FR-COMP-09 | AI assistant: generate caption variants (Persian, brand-voice aware), suggest hashtags, suggest best-time. | SHOULD (P2) |
| FR-COMP-10 | Submit for approval (Phase 2): routes to approvers; locks edits. | MUST (P2) |
| FR-COMP-11 | Bulk compose (CSV) — NICE. | NICE (P3) |

### 6.4 Calendar / Planner (FR-CAL)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CAL-01 | Month / Week / Day views, all Jalali, Persian weekday names, Iranian holidays overlaid, Sat–Wed work-week shading. | MUST |
| FR-CAL-02 | Posts rendered as color-coded chips by platform/status; multi-post days show count + popover. | MUST |
| FR-CAL-03 | Drag-and-drop reschedule (with confirm); snap to allowed time slots; respects queue. | MUST |
| FR-CAL-04 | Per-channel swimlane toggle / "all channels" overlay. | MUST |
| FR-CAL-05 | Click empty slot → quick-create (opens Compose pre-filled). | MUST |
| FR-CAL-06 | Agenda (list) view for accessibility. | SHOULD |
| FR-CAL-07 | Queue sub-tab: list of pending jobs with status, retry, cancel, reassign. | MUST |
| FR-CAL-08 | Best-time suggestions per channel (AI). | SHOULD (P2) |
| FR-CAL-09 | Export calendar (PDF/CSV) and iCal feed. | NICE (P3) |

### 6.5 Campaigns (FR-CAMP)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CAMP-01 | Campaign portfolio list with health label/color, owner, progress, goal completion, days remaining, top blocker. | MUST |
| FR-CAMP-02 | Create/edit campaign: name, description, status (active/paused/completed/archived), start/end dates (Jalali), goal type & value, owner. | MUST |
| FR-CAMP-03 | Per-campaign command center tabs: Overview, Calendar, Posts, Media, Report. | MUST |
| FR-CAMP-04 | Overview: health summary, progress vs goal, blocker, recent activity. | MUST |
| FR-CAMP-05 | Posts: all posts in the campaign with status; filter/sort. | MUST |
| FR-CAMP-06 | Media: media assets attached to campaign posts. | MUST |
| FR-CAMP-07 | Report: campaign-scoped analytics (reach, engagement, conversions vs goal). | SHOULD (P2) |
| FR-CAMP-08 | Archive / duplicate / clone-with-new-dates. | SHOULD |

### 6.6 Content Library (FR-CONT)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CONT-01 | Reusable content items (title, body, hashtags, note) with status lifecycle (draft → review → approved → scheduled → published → failed). | MUST |
| FR-CONT-02 | Search by text, filter by status/campaign/platform/tag. | MUST |
| FR-CONT-03 | Create from scratch or "save from composed post". | MUST |
| FR-CONT-04 | Duplicate / version history. | SHOULD (P2) |
| FR-CONT-05 | Bulk actions (tag, archive, delete). | SHOULD |

### 6.7 Media Library & Editor (FR-MEDIA)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-MEDIA-01 | Upload (image/video), store with metadata (name, type, size, dims, folder, tags). | MUST |
| FR-MEDIA-02 | Folder organization (default: عمومی); tags; search; filter. | MUST |
| FR-MEDIA-03 | Grid + list views; preview; reuse in Compose. | MUST |
| FR-MEDIA-04 | Persian-first image editor: crop (per aspect ratio: 1:1, 4:5, 9:16, 16:9, 1.91:1), rotate, filters, text overlay (Vazirmatn, RTL), stickers/shapes. | MUST |
| FR-MEDIA-05 | Video trim + thumbnail select (basic). | SHOULD (P3) |
| FR-MEDIA-06 | Storage quota per plan; quota indicator. | MUST |
| FR-MEDIA-07 | Media processing server-side (Sharp for images; ffmpeg for video thumbnails) with size/resolution enforcement per platform. | MUST |

### 6.8 Inbox (FR-INBOX) — Phase 2

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-INBOX-01 | Unified stream of comments, DMs, mentions across connected channels; filter by channel/type/status/assignee. | MUST (P2) |
| FR-INBOX-02 | Thread view; reply inline (publishes to the source channel via the appropriate API). | MUST (P2) |
| FR-INBOX-03 | Assign a conversation to a member; SLA timer (first-response, resolution). | MUST (P2) |
| FR-INBOX-04 | Saved replies (snippets) with variables (e.g., {name}). | MUST (P2) |
| FR-INBOX-05 | Auto-tagging rules (keyword → tag). | SHOULD (P2) |
| FR-INBOX-06 | Automation events log (comment-to-DM triggers fired, DMs sent, policy-window status). | MUST (P2) |
| FR-INBOX-07 | Mark read/unread, archive, close. | MUST (P2) |
| FR-INBOX-08 | Response-time analytics (median first-response, by channel/agent). | SHOULD (P2) |

### 6.9 Analytics & Reports (FR-ANL)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-ANL-01 | Executive metrics: engagement, reach, audience growth, active campaigns with period comparison and sparklines. | MUST |
| FR-ANL-02 | Per-platform breakdown; per-campaign breakdown. | MUST |
| FR-ANL-03 | Metrics taxonomy: reach, impressions, engagement rate, follower growth, link clicks, conversions (where measurable), publish success rate, inbox response time. | MUST |
| FR-ANL-03a | Persian-digit formatting for all numbers; Jalali date axis on charts. | MUST |
| FR-ANL-04 | Time-series charts (Recharts) with period selector. | MUST |
| FR-ANL-05 | Exportable reports (PDF, CSV); scheduled email reports. | SHOULD (P3) |
| FR-ANL-06 | Logs sub-tab: publishing audit log (attempts, payloads, errors) with filter/export. | MUST |
| FR-ANL-07 | Best-time-to-post heatmap per channel. | SHOULD (P2) |
| FR-ANL-08 | Competitor benchmarking / share of voice. | NICE (P4+) |

### 6.10 Channels / Connections (FR-CH)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CH-01 | Channel hub: list connected accounts per platform with status, last success, last error, token expiry. | MUST |
| FR-CH-02 | Instagram: OAuth flow (Meta), connect professional account, store tokens (encrypted), refresh. | MUST |
| FR-CH-03 | Rubika: add bot token + chat_id; health check (send test). | MUST |
| FR-CH-04 | Telegram: add bot token; connect to channel as admin; health check. | MUST (P2) |
| FR-CH-05 | LinkedIn: OAuth flow; connect member/page. | MUST (P2) |
| FR-CH-06 | Token expiry warnings (Action Center + email). | MUST |
| FR-CH-07 | Disconnect / reconnect; per-account enable/disable. | MUST |
| FR-CH-08 | Channel detail page with breadcrumbs; per-account analytics link. | SHOULD |

### 6.11 Settings / Brand Kit (FR-SET)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-SET-01 | Store/workspace profile: name, category, phone, description, logo, avatar, timezone (default Asia/Tehran). | MUST |
| FR-SET-02 | Brand kit: primary color, accent color, brand voice, default CTA, content guidelines, default hashtags, caption footer. | MUST |
| FR-SET-03 | Brand kit consumed by Compose (default hashtags/footer appended) and AI assistant (brand-voice conditioning). | MUST |
| FR-SET-04 | Team members list with roles; invite/remove. | MUST (P2) |
| FR-SET-05 | Notification preferences (email, in-app). | SHOULD |
| FR-SET-06 | Billing & plan (IRR, local gateway). | MUST (P1 launch) |
| FR-SET-07 | Workspace export (content, media metadata, analytics CSV). | SHOULD (P3) |

### 6.12 Notifications (FR-NOTIF)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-NOTIF-01 | In-app notification center (bell) with unread badge. | MUST |
| FR-NOTIF-02 | Events: publish success/failed, approval requested/approved/rejected, inbox new message, token expiring, channel disconnected. | MUST |
| FR-NOTIF-03 | Email notifications (configurable). | SHOULD |
| FR-NOTIF-04 | Real-time push via WebSocket. | SHOULD |

## 7. Non-Functional Requirements (NFR)

### 7.1 Performance
- **NFR-PERF-01**: First Contentful Paint ≤ 1.5s, Largest Contentful Paint ≤ 2.5s on the
  dashboard route (4G mobile profile, Iran network, P75).
- **NFR-PERF-02**: API P95 response ≤ 300ms for read endpoints, ≤ 600ms for write
  endpoints (excluding downstream channel API calls).
- **NFR-PERF-03**: Scheduled-publish attempt within 30s of scheduled time (median),
  P95 ≤ 2 min.
- **NFR-PERF-04**: Dashboard supports 100 concurrent workspace users without degradation
  on the target infra.

### 7.2 Scalability
- **NFR-SCALE-01**: Architecture supports 10,000 workspaces and 100,000 scheduled jobs/day
  at launch-target infra; horizontally scalable workers.
- **NFR-SCALE-02**: Per-channel queue isolation prevents one channel's rate-limit from
  blocking others.
- **NFR-SCALE-03**: Database read replicas for analytics queries; write path stays on
  primary.

### 7.3 Reliability & Resilience
- **NFR-REL-01**: Publish success rate ≥ 98% (rolling 24h).
- **NFR-REL-02**: Zero data loss on worker crash — durable state machine + idempotency.
- **NFR-REL-03**: Retry with exponential backoff + jitter; circuit breaker per channel.
- **NFR-REL-04**: DLQ for unrecoverable jobs; manual retry/discard from UI.
- **NFR-REL-05**: Graceful degradation: if Instagram API is down, Instagram jobs queue +
  retry; other channels unaffected; UI surfaces the channel status.

### 7.4 Security
- **NFR-SEC-01**: All secrets (OAuth tokens, bot tokens) encrypted at rest (AES-256);
  keys in a secrets manager, never in code/DB plaintext.
- **NFR-SEC-02**: TLS 1.2+ everywhere; HSTS; secure cookies.
- **NFR-SEC-03**: Server-side RBAC enforcement on every API endpoint; no client-trust.
- **NFR-SEC-04**: Input validation (Pydantic/Zod) on all endpoints; SQLi/XSS protection.
- **NFR-SEC-05**: Rate limiting on auth endpoints (brute-force protection).
- **NFR-SEC-06**: OWASP Top 10 coverage; dependency vulnerability scanning in CI.
- **NFR-SEC-07**: Data residency: option to host in Iran for Iran customers (P3).

### 7.5 Observability
- **NFR-OBS-01**: Structured logging (JSON) with request IDs; centralized log retention
  ≥ 90 days.
- **NFR-OBS-02**: Metrics (Prometheus-style): publish success rate, queue depth, worker
  latency, API latency, error rates — dashboarded.
- **NFR-OBS-03**: Alerting on: publish success rate < 95%, queue depth > threshold,
  channel circuit-breaker tripped, auth error spike.
- **NFR-OBS-04**: Distributed tracing across frontend → API → worker → channel adapter.

### 7.6 Maintainability
- **NFR-MAINT-01**: TypeScript strict; Python type hints; ≥ 80% line coverage on
  business logic.
- **NFR-MAINT-02**: E2E (Playwright) covering all golden paths; runs in CI.
- **NFR-MAINT-03**: Lint + typecheck gates in CI; no merge on failure.
- **NFR-MAINT-04**: migrations are reversible and tested; CI runs `alembic upgrade head`
  + `alembic downgrade -1` + `upgrade head`.

### 7.7 Accessibility
- **NFR-A11Y-01**: WCAG 2.1 AA: semantic HTML, ARIA, keyboard nav, focus management,
  color contrast ≥ 4.5:1 (3:1 for large text).
- **NFR-A11Y-02**: Screen-reader tested (NVDA/VoiceOver) on key flows.
- **NFR-A11Y-03**: RTL-correct focus order and mirroring; no LTR assumptions.

### 7.8 Localization & i18n
- **NFR-I18N-01**: All UI strings externalized (Persian default); English fallback for
  vendor/dev.
- **NFR-I18N-02**: Persian-digit formatting utility; applied to all numbers/dates in UI.
- **NFR-I18N-03**: Jalali date conversion utility; all date pickers/renderers use it.
- **NFR-I18N-04**: Bidirectional text handling in composer (correct cursor, selection,
  mixed Persian/English/URLs).

## 8. Channel Integration Requirements

### 8.1 Instagram (Meta Graph API v25+)

- **Prerequisite**: Professional (Business/Creator) account linked to a Facebook Page;
  Meta App in App Review with scopes: `instagram_basic`,
  `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_messages`,
  `pages_show_list`, `pages_read_engagement`.
- **Publishing flow**: two-step (create media container → publish). Adapter must handle:
  single image, carousel (children containers), Reels (resumable upload via
  rupload.facebook.com), Stories.
- **Rate limit**: 100 API-published posts / 24h rolling / account (carousels = 1). Adapter
  must query `/content_publishing_limit` and backpressure the queue.
- **Container expiry**: ~24h; publish promptly or re-create.
- **AI media**: set `is_ai_generated=true` where applicable (Meta policy).
- **Personal accounts**: no Content Publish API → **reminder/manual mode** (notification +
  pre-filled caption/media to copy). UI must clearly distinguish.
- **Webhooks**: subscribe to `comments`, `messages`, `mentions` (Phase 2 inbox + automation).
- **Token refresh**: long-lived tokens refreshed before expiry; warnings in Action Center.

### 8.2 Rubika (Bot API v3 — `botapi.rubika.ir/v3`)

- **Auth**: bot token + chat_id; health check via test message send.
- **Publishing**: send message (text, photo, video, document) to a channel/chat via the
  bot. Adapter maps Nashrino content → Rubika message format (caption, media, inline
  keyboards for CTAs).
- **Rate limiting**: respect Rubika's per-bot rate limits; backoff on 429/5xx.
- **Resilience**: Rubika API can be unstable; adapter must retry with backoff, surface
  `اختلال API` status, and degrade to manual.
- **Limitations**: no Stories/Reels equivalent; treat as feed + channel messaging.

### 8.3 Telegram (Bot API)

- **Auth**: bot token; bot must be admin of the target channel.
- **Publishing**: `sendMessage` / `sendPhoto` / `sendVideo` / `sendMediaGroup` to the
  channel; support markdown/HTML formatting, inline keyboard buttons (CTAs).
- **Rate limiting**: ~30 msg/sec global, 1 msg/sec per chat; bulk scheduling must pace.
- **Phase 2** scope.

### 8.4 LinkedIn (Marketing / Share API)

- **Auth**: OAuth 2.0; member + optionally Company Page.
- **Publishing**: text share, image share (two-step upload), article share, video share.
- **Rate limiting**: per-application + per-member daily caps; backpressure.
- **Phase 2** scope.

### 8.5 Eitaa (Bot API) — Phase 3

- Bot-token based; similar adapter pattern to Rubika/Telegram.

### 8.6 Adapter contract (all channels)

Every channel adapter implements a common interface:
```
class ChannelAdapter:
    async def health_check(account) -> HealthResult
    async def validate_readiness(content, account) -> ReadinessResult
    async def publish(job) -> PublishResult   # idempotent
    async def refresh_token(account) -> Account
    async def fetch_inbox(account, since) -> list[InboundMessage]   # Phase 2
    async def reply(account, message, text) -> ReplyResult           # Phase 2
```
- Adapters are **stateless** (all state in DB); safe to run in parallel workers.
- Every adapter call is wrapped in retry+backoff with channel-specific policies.

## 9. Data Model Requirements

The vendor shall implement the data model defined in
[05_TECHNICAL_ARCHITECTURE.md §Data Model](./05_TECHNICAL_ARCHITECTURE.md). The
production schema extends the existing Alembic migrations (`users`, `stores`,
`rubika_accounts`, `posts`, `media_assets`, `publish_attempts`) and the Prisma prototype
schema (`Workspace`, `WorkspaceMember`, `Platform`, `Campaign`, `Content`,
`ContentPlatform`, `PublishJob`, `Media`, `InboxMessage`, `AnalyticsSnapshot`,
`AppSetting`) into one coherent PostgreSQL schema. Key requirements:

- **Multi-tenancy**: every tenant-scoped table has `workspace_id` with a foreign key to
  `workspaces` and a composite index on `(workspace_id, <common_filter>)`; row-level
  isolation enforced in the data layer.
- **Publishing state machine**: `publish_jobs.status` ∈ {pending, processing, live,
  success, failed, action}; transitions audited in `publish_attempts`.
- **Idempotency**: `publish_jobs.idempotency_key` unique per workspace; adapter checks
  before retry.
- **Soft deletes** for user-facing entities (content, media, campaigns) with
  `deleted_at`; hard delete only via explicit admin action.
- **Timestamps**: `created_at`, `updated_at` on all entities; `deleted_at` nullable.
- **Migrations**: every model change ships as a reversible Alembic migration; CI runs
  up/down/up.

## 10. Security, Privacy & Compliance Requirements

- **Data minimization**: collect only data needed for the feature; no third-party
  tracking without consent.
- **Encryption**: TLS in transit; AES-256 at rest for tokens and PII fields.
- **Secrets management**: OAuth/bot tokens never logged, never returned to the client
  in API responses (server-side redaction).
- **Access control**: RBAC enforced server-side; workspace isolation; admin-only
  destructive actions.
- **Audit log**: immutable log of security-relevant events (auth, role changes, token
  connect/disconnect, data exports) retained ≥ 12 months.
- **Meta policy compliance** (Instagram): adhere to Meta Platform Terms, Instagram
  Graph API rate limits, Messaging API 24-hour window & message-tag rules, AI-content
  disclosure. Maintain a compliance log for automation events.
- **Iranian data protection**: align with relevant Iranian data-protection regulations;
  option for Iran-resident hosting (P3).
- **GDPR-aware design** (for any non-Iran customers in future): right to export, right
  to delete; data-retention policy documented.
- **Vulnerability management**: automated dependency scanning (npm audit, pip-audit,
  Trivy) in CI; monthly manual review of critical dependencies.

## 11. Instagram Comment-to-DM Automation — Detailed Spec

This flagship feature is specified in detail here because of its policy sensitivity.

### 11.1 Objective
Allow a workspace to define rules: "when a user comments a specific keyword on a
specific Instagram post (or all posts), automatically send them a DM with defined
content" — compliant with Meta's Messaging API policy, tuned for Persian commerce.

### 11.2 Rule model
```
AutomationRule {
  id, workspace_id, instagram_account_id,
  trigger_type: "comment_keyword" | "comment_regex" | "comment_mention",
  trigger_value: string (e.g., "کد" or regex),
  target_scope: "all_posts" | "specific_posts" (post_id list),
  dm_message: text (supports variables {username}, {post_caption}),
  dm_media_url: optional,
  enabled: boolean,
  created_at, updated_at
}
```

### 11.3 Trigger flow
1. Instagram webhook delivers a `comments` event to the backend.
2. Automation engine evaluates enabled rules for that post + account.
3. If a rule matches (keyword/regex, with Persian/Arabic-Indic digit normalization),
   enqueue a "send DM" task.
4. Worker sends DM via Messaging API `POST /{ig-user-id}/messages` within the 24h window
   opened by the comment.
5. Log the event in `automation_events` (rule_id, comment_id, user_id, dm_message_id,
   status, sent_at, policy_window_expires_at).

### 11.4 Compliance rules (non-negotiable)
- **24-hour window**: DMs only sent within 24h of the user's comment. If outside, log
  `skipped_window_expired` and surface in inbox for manual reply.
- **`HUMAN_AGENT` tag**: used only for genuine support follow-up, extends to 7 days;
  never for promotional content.
- **No unsolicited DMs**: a DM is sent only as a direct response to a triggering comment.
- **Opt-out**: if a user replies "stop"/"توقف", suppress future automated DMs to them
  (per-rule or global).
- **Rate limiting**: respect Messaging API rate limits; pace sends.
- **Bot disclosure**: where required, the DM or profile indicates automated responses.
- **Audit**: every automation event retained ≥ 90 days with full context for compliance
  review.

### 11.5 Persian-specific handling
- **Digit normalization**: normalize Persian (۰-۹) and Arabic-Indic (٠-٩) digits to
  ASCII (0-9) before regex match, so "کد۱" and "کد1" both match rule "کد\d+".
- **Keyword sets**: common Persian commerce triggers pre-seeded (کد, قیمت, لینک,
  خرید, ثبت‌نام, آدرس).
- **Bidi-safe DM composition**: variables and user mentions inserted with correct
  directional marks.

### 11.6 Personal-account fallback
Personal Instagram accounts cannot use the Messaging API → automation is **disabled**;
the inbox surfaces triggering comments for manual reply (reminder mode).

## 12. Design & UX Requirements

See [06_DESIGN_SYSTEM.md](./06_DESIGN_SYSTEM.md) for the full token set and component
spec. Headline requirements:

- **RTL-native**: `<html dir="rtl" lang="fa">`; all layouts mirror correctly; icons,
  spacing, and focus order follow RTL conventions.
- **Persian-first typography**: Vazirmatn as the primary font; numerals render in
  Persian digits in the UI.
- **Jalali-native**: all date pickers, calendar, and date axes use Jalali.
- **Design tokens**: the existing `--n-*` / `app-*` token system (in `globals.css`) is
  the single source of truth; no hardcoded colors except the documented media-editor
  exception.
- **Components**: shadcn/ui (New York) as the base; custom components conform to tokens.
- **Dark/light themes**: both fully supported; default dark.
- **Responsive**: mobile-first; works from 360px; sidebar collapses to a drawer.
- **Accessibility**: WCAG 2.1 AA (per NFR-A11Y).
- **Motion**: subtle Framer Motion transitions (page, hover, focus); respects
  `prefers-reduced-motion`.
- **Sticky footer**: where footers exist, they stick to the bottom on short pages and
  push down naturally on long pages.

## 13. Deliverables & Milestones

The vendor shall deliver the phased milestones in [04_Roadmap.md](./04_ROADMAP.md). At
each phase exit, the following are required:

| Deliverable | Per phase |
|-------------|-----------|
| Working software deployed to staging | ✅ |
| E2E test suite covering the phase's golden paths, passing in CI | ✅ |
| Updated API documentation (OpenAPI) | ✅ |
| Migration scripts (reversible, tested up/down/up) | ✅ |
| Lighthouse + a11y audit report | ✅ |
| Release notes (Persian + English) | ✅ |
| Demo walkthrough (recorded) | ✅ |

**Key milestones** (target dates in [04_Roadmap.md](./04_ROADMAP.md)):
- M1 — MVP (Phase 1) staging: multi-channel publish live end-to-end.
- M2 — Collaboration & Engagement (Phase 2): inbox + approvals + automation live.
- M3 — GA launch (end of Phase 2 hardening): production, billing, onboarding.
- M4 — Scale (Phase 3): Eitaa, advanced analytics, PWA.

## 14. Technical Constraints & Stack

**Mandatory stack** (non-negotiable):
- **Frontend**: Next.js 16 (App Router), TypeScript 5 strict, Tailwind CSS 4,
  shadcn/ui (New York), Vazirmatn font, next-themes, Zustand (client state),
  TanStack Query (server state), Recharts (charts), Framer Motion (motion).
- **Backend**: FastAPI (Python 3.12), SQLAlchemy 2.x, Alembic, Pydantic v2.
- **Database**: PostgreSQL 16.
- **Queue**: Redis 7 + Celery 5 (worker + beat).
- **Runtime**: Docker Compose (dev), containerized (prod).
- **CI**: GitHub Actions (lint, typecheck, test, build, migrate check, audit) — the
  provided `.github/workflows/ci.yml` is the baseline.

**Constraints**:
- z-ai-web-dev-sdk (if used for AI features) runs **server-side only**.
- No client-side secrets; all channel API calls go through the backend.
- All API requests use relative paths (Caddy gateway in the sandbox; production uses
  standard routing).

## 15. Acceptance Criteria & Definition of Done

A feature is **Done** when **all** of the following hold:
1. Functional requirements met and verified in the browser (Agent Browser or Playwright).
2. E2E test(s) written and passing in CI.
3. Lint + typecheck clean.
4. RTL + Jalali verified (no LTR bleed; Persian digits; Jalali dates).
5. Accessibility check passed (keyboard nav, ARIA, contrast).
6. Responsive check passed (360px, 768px, 1280px+).
7. API documented (OpenAPI) and RBAC-protected.
8. Migration (if schema change) reversible and tested.
9. Observability: logs + metrics + (if relevant) alert wired.
10. Security: no secrets in code; inputs validated; RBAC enforced.
11. Release notes updated.
12. Code reviewed and merged to `main`.

## 16. Vendor Evaluation Criteria

Proposals will be evaluated on:

| Criterion | Weight |
|-----------|--------|
| Demonstrated understanding of Persian-first / RTL / Jalali challenges | 20% |
| Proven experience with Next.js 16 + FastAPI + Celery + PostgreSQL at scale | 15% |
| Proven experience with Meta Graph API (IG publishing + Messaging) | 15% |
| Resilient systems design (queue/retry/idempotency/circuit breaker) | 15% |
| UX/design quality (portfolio of RTL or Persian products a plus) | 10% |
| Testing discipline (E2E, CI, coverage) | 10% |
| Timeline realism & phased delivery plan | 10% |
| Price / value | 5% |

## 17. Response Format & Submission

The vendor's proposal shall include:
1. **Executive summary** (1–2 pages): understanding of the problem, proposed approach.
2. **Team**: roles, experience, relevant past work (especially Persian/RTL + Meta API).
3. **Technical approach**: architecture confirmation or proposed changes to
   [05_TECHNICAL_ARCHITECTURE.md](./05_TECHNICAL_ARCHITECTURE.md), with rationale.
4. **Phased plan**: milestone dates against [04_Roadmap.md](./04_ROADMAP.md), with
   assumptions and risks.
5. **Risk register**: top risks + mitigations.
6. **Pricing**: fixed or T&M, per phase, in IRR (or USD with IRR note).
7. **References**: 2–3 relevant past clients with contact info.

## 18. Terms, Assumptions & Risks

**Assumptions**:
- The client provides Meta App credentials (App ID/secret, reviewed scopes) and a
  verified Instagram professional + Facebook Page for development.
- The client provides Rubika/Telegram bot tokens for development.
- The client provides the production hosting environment (or specifies the target).
- Access to the existing prototype workspace and FastAPI reference is granted on
  contract signature.

**Risks to price/schedule** (shared):
- Meta App Review latency (can take weeks) — mitigation: begin review day one; develop
  against a test app in the meantime.
- Rubika/Eitaa API instability — mitigation: adapter resilience + manual fallback.
- Iranian network conditions affecting CI/CD and media fetch — mitigation:
  Iran-resilient infra + caching + retry.
- Scope creep — mitigation: change-control process; this RFP + backlog is the baseline.

**Change control**: any change to scope, schedule, or price follows a written
change-request process signed by both parties.

---

*End of RFP.*

# 04 — Roadmap

> **Phased release plan** from the current prototype → production GA → scale.
> Dates are **target windows** (Jalali with Gregorian equivalents) assuming a ~7-person
> team at ~60 pts/sprint (2-week sprints). Adjust on vendor confirmation. Story IDs
> reference [03_PRODUCT_BACKLOG.md](./03_PRODUCT_BACKLOG.md).

## Roadmap at a glance

| Phase | Name | Target window | Theme | Exit criteria |
|-------|------|---------------|-------|---------------|
| **P0** | Foundations & Stabilization | Weeks 1–3 | Unify prototype + backend; ship real infra | Staging stack live; schema unified; CI green; fixtures removed from dashboard |
| **P1** | MVP — Multi-Channel Publishing Core | Weeks 4–10 | Connect → Compose → Schedule → Publish (resilient) | End-to-end publish to IG + Rubika; ≥98% success rate on staging |
| **P2** | Collaboration & Engagement | Weeks 11–18 | Inbox, approvals, automation, AI, RBAC | Comment-to-DM live + compliant; approvals flow; AI captions |
| **P3** | Scale & Harden (GA) | Weeks 19–24 | Eitaa, listening, PWA, reports, billing GA | Production GA with paying customers |
| **P4+** | Expand | Weeks 25+ | Listening depth, attribution, more channels, mobile native | Per-quarter releases |

---

## Phase 0 — Foundations & Stabilization (Weeks 1–3)

**Goal**: Turn the prototype (fixtures) + partial backend into one real, observable,
CI-gated system. No new user-facing features — just the runway.

### In scope
- **S-FOUND-01** Provision production stack (Postgres, Redis, Celery, FastAPI, Next.js)
- **S-FOUND-02** Unify database schema (prototype Prisma + Alembic → one PostgreSQL schema)
- **S-FOUND-03** Multi-tenant data-access layer
- **S-FOUND-04** FastAPI app skeleton + middleware
- **S-FOUND-05** Next.js → FastAPI client + TanStack Query wiring (remove fixtures)
- **S-FOUND-06** Design-token bridge & UI primitives
- **S-FOUND-07** CI pipeline (lint/typecheck/test/build/migrate/audit)
- **S-FOUND-08** Jalali + Persian-digit utility library
- **S-FOUND-09** Observability baseline (logs/metrics/tracing)
- **S-AUTH-01/02/03/04** Admin auth + password reset + session + workspace membership (minimal, to unblock P1)

### Exit criteria (Definition of Phase Done)
1. `docker compose up -d --build` runs all services; `/health` + `/health/db` green.
2. `alembic upgrade head` / `downgrade -1` / `upgrade head` clean in CI.
3. Dashboard renders from backend data (zero fixture imports in `page.tsx`/dashboard
   components).
4. A workspace-scoped API call returns only that workspace's data (negative test passes).
5. CI green on lint + typecheck + test + build + migrate + audit.
6. JSON logs with trace IDs; `/metrics` exposes publish-success, queue-depth, latency.
7. Jalali + Persian-digit utilities unit-tested.

### Deliverables
- Staging environment URL (internal).
- OpenAPI spec skeleton for P1 endpoints.
- E2E smoke test: login → see dashboard with backend data.

### Risks this phase de-risks
- Schema drift between prototype and backend → unified early.
- Multi-tenant leaks → enforced in data layer before any feature code.
- RTL/Jalali quality → utilities + token audit gate established now.

---

## Phase 1 — MVP: Multi-Channel Publishing Core (Weeks 4–10)

**Goal**: A team can connect Instagram + Rubika, compose once, schedule on a Jalali
calendar, and publish resiliently — and see a real dashboard, media library, content
library, campaigns, and analytics foundations.

### In scope (by epic)
- **E-CH** (partial): `S-CH-01/02/03/04/07/08/09` — Channel hub, IG OAuth (pro +
  reminder mode), Rubika connect, token warnings, adapter interface + IG + Rubika
  adapters.
- **E-COMP**: `S-COMP-01–08` — Full multi-step composer with live preview + readiness.
- **E-CAL**: `S-CAL-01–07` — Jalali month/week/day, drag-reschedule, swimlanes,
  quick-create, queue sub-tab.
- **E-PUB**: `S-PUB-01–09` — Per-channel queues, durable state machine, idempotency,
  retry+backoff, circuit breaker, DLQ, audit log, beat scheduler, metrics.
- **E-MEDIA**: `S-MEDIA-01–06` — Upload, folders/tags, Persian-first image editor,
  reuse, quota, platform-spec enforcement.
- **E-CONT**: `S-CONT-01–03` — Content lifecycle, search/filter, create/save.
- **E-CAMP**: `S-CAMP-01–04` — Portfolio, create/edit, command center, attach posts.
- **E-DASH**: `S-DASH-01–06` — Full dashboard from backend data.
- **E-ANL** (partial): `S-ANL-01/02/04` — Metrics endpoints, analytics charts, logs
  sub-tab.
- **E-WS**: `S-WS-01–04` — Workspace profile, brand kit, brand-kit consumption,
  timezone/locale.
- **E-BILL** (partial): `S-BILL-01/03/04` — Plan tiers, quota enforcement, invoice
  history (gateway in P1.5 — see below).
- **E-A11Y** (partial): `S-A11Y-01/02/03` — RTL audit, keyboard/ARIA, contrast.

### Key milestone: M1 — MVP Staging (end of Week 10)
**Demoable golden path**: Admin logs in → connects Instagram (pro) + Rubika → composes
a post with media → previews per platform → schedules on the Jalali calendar → the
worker publishes to both channels → dashboard shows success → analytics updates → a
failed publish retries and surfaces in the Action Center.

### Exit criteria
1. End-to-end publish to Instagram + Rubika succeeds on staging; Telegram + LinkedIn
   adapters code-complete but behind a flag (P2 activation).
2. Publish success rate ≥ 98% over a 24h soak test (synthetic load).
3. Scheduled-time P95 ≤ 2 min.
4. Circuit breaker trips on induced channel failure and recovers on health-check.
5. DLQ + manual retry verified.
6. Dashboard, Calendar, Compose, Media, Content, Campaigns, Analytics all read/write
   backend (no fixtures).
7. Persian-first image editor produces correct per-platform crops with Vazirmatn text.
8. Lighthouse mobile ≥ 90 on dashboard; WCAG AA on P1 views.
9. E2E (Playwright) covers: login, connect channel, compose, schedule, publish (mocked
   channel for determinism), dashboard, calendar drag-reschedule.

### P1.5 — Billing GA mini-phase (Week 10, parallel)
- **S-BILL-02** Local payment gateway (Zarinpal) integration.
- Paid plans go live for invited beta cohort.

### Risks & mitigations (P1)
| Risk | Mitigation |
|------|------------|
| Meta App Review delays IG publishing | Start review Week 1; develop against test app; reminder mode as fallback. |
| Rubika API instability | Adapter resilience + manual fallback; health checks. |
| Persian-first image editor scope creep | Ship crop+rotate+text+filters; defer advanced effects. |
| Publish under-load reliability | Soak test in CI; queue-depth + lag alerts. |

---

## Phase 2 — Collaboration & Engagement (Weeks 11–18)

**Goal**: Turn the MVP into a *team* tool — unified inbox, approvals, Instagram
comment-to-DM automation, Persian AI assistant, RBAC, realtime notifications. Activate
Telegram + LinkedIn publishing.

### In scope (by epic)
- **E-CH** (complete): `S-CH-05/06/10` — Telegram + LinkedIn connect + adapters (activate).
- **E-INBOX**: `S-INBOX-01–09` — Unified stream, thread/reply, assign+SLA, saved
  replies, auto-tagging, automation log, mailbox actions, response-time analytics, IG
  webhooks.
- **E-APPR** (single-level): `S-APPR-01/02/03` — Submit → approve/reject → schedule,
  notifications, lock/unlock.
- **E-AUTO**: `S-AUTO-01–08` — Comment-to-DM engine (compliant), window handling,
  opt-out, personal-account disabled, pre-seeded keywords.
- **E-AI**: `S-AI-01/02/03/06` — Persian caption gen, hashtags, best-time, keyword
  expansion.
- **E-NOTIF**: `S-NOTIF-01–04` — Notification center, event types, email, realtime WS.
- **E-AUTH** (RBAC depth): `S-AUTH-05/06/07` — RBAC enforcement, invite, audit log.
- **E-ANL** (insights): `S-ANL-03/05` — Insight ingestion, best-time heatmap.
- **E-CAMP**: `S-CAMP-05` — Campaign-scoped report.
- **E-A11Y**: `S-A11Y-04` — Screen-reader test + fixes.

### Key milestone: M2 — Collaboration & Engagement live (end of Week 18)
**Demoable golden paths**:
1. **Comment-to-DM**: A test user comments "کد" on an IG post → Nashrino sends a DM
   with the catalog within the 24h window → event logged → user replies "توقف" → future
   DMs suppressed.
2. **Approvals**: Editor composes → submits → Approver gets notification → comments →
   approves → content auto-schedules → Editor notified.
3. **Inbox**: IG comment + DM + TG message arrive → unified inbox → assign to agent →
   reply inline → SLA timer stops.
4. **AI**: In Compose, generate 3 Persian caption variants in brand voice → pick one →
   schedule.

### Exit criteria
1. Comment-to-DM compliant (24h window enforced; HUMAN_AGENT only for support; opt-out
  works; full audit log; personal accounts disabled).
2. Inbox aggregates IG + TG + Rubika + LI; inline reply publishes to source.
3. Single-level approval flow works end-to-end with notifications.
4. RBAC enforced server-side; UI hides disallowed actions.
5. AI caption generation produces Persian, brand-voice-conditioned variants.
6. Realtime WebSocket updates dashboard/inbox/queue without refresh.
7. E2E covers all four golden paths above (with mocked channel APIs for determinism).
8. Compliance review sign-off on the automation engine.

### Risks & mitigations (P2)
| Risk | Mitigation |
|------|------------|
| Meta Messaging API policy change | Stay 24h-window-only by default; monitor tag deprecation; compliance review. |
| Webhook reliability under Iranian network | Idempotent ingest + retry; webhook signature verification; DLQ. |
| AI Persian quality | Brand-voice conditioning + human review prompt; collect feedback for tuning. |
| Inbox scale | Pagination + background ingest; read-replica for inbox reads. |

---

## Phase 3 — Scale & Harden → GA (Weeks 19–24)

**Goal**: Production-grade GA with paying customers, advanced analytics, Eitaa,
listening foundations, PWA, and hardened operations.

### In scope
- **S-SCALE-01** Eitaa adapter.
- **S-SCALE-02** Multi-level approvals (Planable-style, in-context comments).
- **S-SCALE-03** Advanced analytics + scheduled PDF/CSV reports.
- **S-SCALE-04** Social listening foundations (mentions, keyword tracking on IG/TG).
- **S-SCALE-05** PWA + offline-tolerant compose.
- **S-SCALE-07** Iran-resident hosting option (ops).
- Hardening: load testing to 10k workspaces / 100k jobs/day; security review; pen
  test; disaster-recovery runbooks; backup/restore drills.
- Onboarding: first-run experience, in-app tours (Persian), sample-data seeding.
- Documentation: help center (Persian), API docs public, status page.

### Key milestone: M3 — GA Launch (end of Week 24)
- Public launch with paid plans; onboarding flow; ~50 paying beta → first 500 target.
- 99.9% uptime target; publish success ≥ 98%; NPS measured.

### Exit criteria
1. Load test passes 10k workspaces / 100k jobs/day on target infra.
2. Third-party security review: zero criticals, highs remediated.
3. Backup/restore drill successful; RPO ≤ 15 min, RTO ≤ 1 h.
4. Eitaa publishing live; listening MVP ingesting mentions.
5. PWA installable; compose works offline (queues on reconnect).
6. Onboarding: a new user connects a channel and publishes within 5 minutes.

---

## Phase 4+ — Expand (Weeks 25+, quarterly releases)

Themes (research/spike first, then build):
- **Listening depth**: sentiment, share-of-voice, crisis alerts (Brandwatch-inspired).
- **Revenue attribution**: e-commerce integrations (Persian D2C platforms), UTM-based
  conversion tracking, ROI reporting.
- **More channels**: X/Twitter, Threads, YouTube Shorts, Pinterest — as demand.
- **Mobile native apps**: iOS + Android (React Native or native), push notifications.
- **Enterprise**: SSO (SAML/OIDC) — `S-SCALE-06`; advanced governance; custom roles.
- **Marketplace / Public API**: third-party integrations, webhooks out, Zapier-like
  recipes.
- **AI depth**: content repurposing, idea generation, sentiment-aware inbox routing,
  AI image variations.

---

## Cross-phase workstreams (always-on)

These run continuously across phases, not gated to a single phase:

| Workstream | Cadence | Owner |
|------------|---------|-------|
| **Accessibility & RTL** | Every sprint; a11y checklist per PR | Frontend eng + Designer |
| **Observability** | Every sprint; metric/alert per new feature | SRE/Lead |
| **Security** | Monthly review; dependency scan in CI | Lead |
| **Performance budgets** | Per phase; Lighthouse gate in CI | Frontend eng |
| **Persian language QA** | Per feature; native review of copy | Designer/PM |
| **E2E test maintenance** | Per sprint; golden paths green | QA |
| **Compliance (Meta policy)** | Quarterly review; automation engine audit | PM + Lead |

---

## Dependency & critical path

```
P0 Foundations ──► P1 MVP (publish core) ──► P2 Collaboration (inbox/approvals/auto)
                         │                              │
                         └──► P1.5 Billing ─────────────┴──► P3 Scale/GA ──► P4 Expand
```

**Critical path**: P0 → P1 (publish worker + adapters) → P2 (inbox webhooks + automation).
Any slip on the publish worker or Meta App Review slips everything downstream.

**Long-lead items to start Day 1**:
1. Meta App Review (scopes: `instagram_content_publish`,
   `instagram_manage_comments`, `instagram_manage_messages`, `pages_show_list`,
   `pages_read_engagement`).
2. Rubika bot provisioning (bot token + target channel).
3. Production hosting + domain + IRR payment gateway merchant account (Zarinpal).
4. Iran-resilient infra selection (if Iran-resident hosting is required).

---

## Release & launch checklist (M3 GA)

- [ ] All P1+P2+P3 exit criteria met.
- [ ] Load test passed; capacity headroom 3×.
- [ ] Security review: zero criticals/highs open.
- [ ] Backup/restore drill passed; runbooks documented.
- [ ] Status page live; on-call rotation set.
- [ ] Onboarding flow tested with 5 first-time users (Persian).
- [ ] Help center (Persian) published for all launch features.
- [ ] Pricing page live (IRR); payment gateway tested end-to-end.
- [ ] Legal: Terms, Privacy, Meta-compliance disclosure.
- [ ] Comms: launch announcement (Persian + English), demo video.
- [ ] Rollback plan documented; feature flags for risky launches.

---

## Measuring roadmap success (tie to [00 §6](./00_EXECUTIVE_SUMMARY.md))

| Roadmap phase | Primary KPI gate to proceed |
|---------------|------------------------------|
| P0 → P1 | CI green; multi-tenant isolation verified |
| P1 → P2 | Publish success ≥ 98% on staging soak |
| P2 → P3 | Compliance sign-off on automation; E2E golden paths green |
| P3 → GA | Security review clean; load test passed |
| GA + 3 mo | WAW ≥ 2,000; NPS ≥ 40 (per [00 §6](./00_EXECUTIVE_SUMMARY.md)) |

Each phase gate is a go/no-go review with the PM, engineering lead, and designer.

---

*End of roadmap. This is a living document; re-baseline at each phase gate.*

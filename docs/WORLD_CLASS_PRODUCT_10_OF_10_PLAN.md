# Nashrino 10/10 Product Plan

> A research-backed, evidence-gated plan to make Nashrino a world-class social operations product — not merely a feature-complete interface.

| Field | Value |
|---|---|
| Status | Proposed canonical product plan |
| Audit date | 2026-07-03 |
| Audited branch | `main` |
| Product | Nashrino / نشرینو |
| Scope | Product strategy, UI/UX, visual design, motion, accessibility, features, reliability, security, operations, monetization, and evidence |
| Related trackers | #160, #200–#222, #232–#237 |
| Supersedes | The product-planning portions of `docs/04_ROADMAP.md`; complements the production-certification gates in #160 |

---

## 1. Executive decision

Nashrino should not attempt to become a Persian clone of one incumbent. The winning product is a **Persian-first social operating system** that combines:

1. Buffer-level simplicity for publishing and queues.
2. Later-level visual planning.
3. Planable-level collaboration and approval clarity.
4. Sprout/Agorapulse-level inbox operations and reporting.
5. Hootsuite-level breadth only where customer evidence justifies it.
6. A defensible regional moat: correct RTL, Jalali planning, Iranian holidays and work-week semantics, Telegram/Bale/Rubika/Eitaa depth, Persian AI, local billing, and resilient operation under regional network constraints.

The repository already has unusually strong engineering foundations: a transactional outbox, attempt ledger, provider capability registry, RBAC, MFA, distributed tracing, SLOs, CI security gates, dark mode, semantic design tokens, responsive layout work, and a growing automated test suite. The next step is not another cosmetic pass. It is to connect those foundations into a coherent product that is:

- visibly real rather than demo-like;
- fast to learn and fast to operate;
- trustworthy in every success, pending, partial, and failed state;
- differentiated in Persian workflows;
- measurable through user and production outcomes;
- independently verifiable against world-class standards.

**Recommended current product score: 7.6/10.** The path to 10/10 is a sequence of evidence gates, not a larger feature checklist.

---

## 2. What “10/10” means

A 10/10 release is not “all issues closed” and is not “the screens look modern.” It means the exact release candidate has demonstrated all of the following.

### 2.1 User outcome proof

- A new qualified user connects a real channel and completes a first successful publish in **5 minutes or less** at the median.
- At least **90% of moderated usability-test participants** complete the five golden tasks without facilitator rescue.
- System Usability Scale target: **85+** for the primary operator persona.
- The product explains limitations, provider support levels, permissions, and uncertain outcomes before the user makes a costly mistake.
- Empty states, loading states, offline states, partial-data states, provider-policy states, and failure states are designed—not hidden behind spinners, blank cards, or generic toasts.

### 2.2 Visual and interaction proof

- Every production route has intentional information hierarchy, responsive behavior, keyboard behavior, dark/light parity, and content-realistic screenshots.
- No hard-coded user, workspace, plan, avatar, metric, “live” state, or success claim is presented as real data.
- Motion communicates continuity, causality, hierarchy, or status. Decorative motion never competes with work.
- Reduced-motion users receive a complete, non-degraded experience.
- Visual regression coverage protects all core flows at representative phone, tablet, laptop, and wide-desktop widths.

### 2.3 Functional proof

- The core loops—connect, create, approve, schedule, publish, recover, engage, analyze—work end to end with certified providers.
- Queue scheduling, calendar planning, per-channel adaptation, content versioning, media management, inbox routing, reporting, and billing have production-grade workflows rather than placeholder surfaces.
- “Beta,” “experimental,” and “certified” provider labels are backed by explicit test evidence and release criteria.

### 2.4 Engineering and operational proof

- The exact built, scanned, tested, staged, approved, and deployed artifacts are traceable.
- Field Core Web Vitals meet the “good” thresholds at the 75th percentile for supported devices and networks.
- WCAG 2.2 AA is verified across all golden paths, including non-drag alternatives and accessible authentication.
- OWASP ASVS 5.0 Level 2 is assessed; all critical/high findings are closed before GA.
- Disaster recovery, queue reconstruction, rollback, and mixed-version compatibility are exercised with committed evidence.
- Product delivery is measured with DORA metrics, not commit volume or AI-token usage.

### 2.5 Business proof

- Activation, retention, publish reliability, response-time, and conversion metrics are instrumented and reviewed.
- Pricing and entitlements are enforced server-side.
- Support, status, privacy, deletion/export, and incident communication are launch-ready.
- There is a defensible reason for a Persian team to choose Nashrino even if an incumbent reduces price.

---

## 3. Current-state audit

### 3.1 Strong foundations already present

The following should be protected, completed, and documented rather than rebuilt:

- Next.js 16, PostgreSQL, Prisma 7, BullMQ, Redis, Socket.IO, and a modular-monolith direction.
- Transactional outbox, durable publication states, duplicate-prevention fingerprints, attempt history, DLQ/replay, circuit-breaker concepts, and uncertain-outcome reconciliation.
- Provider capability validation in Compose before submission.
- Real draft autosave, local/server conflict handling, review and publish actions, Jalali scheduling, optimistic feedback, and ARIA announcements.
- RBAC, MFA, Argon2id, encrypted provider secrets, CSP nonce, rate limiting, secure invitations, and last-admin protections.
- Prometheus metrics, OpenTelemetry tracing, SLOs, alert rules, dashboards, and runbooks.
- Deterministic migration checks, schema drift checks, strict type checks, unit/contract/integration/E2E tests, CodeQL, secret scanning, license checks, container scanning, bundle budgets, and load smoke tests.
- A semantic OKLCH token system, Persian-first typography, light/dark themes, RTL logical-property rules, responsive navigation, mobile bottom navigation, and reduced-motion CSS fallback.
- A benchmark backlog covering queues, best-time suggestions, bulk scheduling, inbox operations, media management, brand governance, reports, billing, PWA, and regional planning.

### 3.2 Product gaps visible in the current repository

#### A. Some shell content still looks like a prototype

The desktop sidebar currently contains a hard-coded workspace, plan, user identity, external avatar, role, and a visually “live” indicator. Those details undermine trust even when the underlying architecture is real. The shell must read authenticated user/workspace/subscription/realtime state, provide meaningful fallbacks, and make every action functional.

**Required correction:** create a single `ShellContext`/query contract containing current user, workspace, role, plan, unread counts, realtime status, environment badge, and support links. Remove all demo identities from production rendering.

#### B. Quality tests often prove rendering, not task success

Some critical E2E tests accept broad outcomes such as “main content exists,” “auth redirect is acceptable,” or “no JS crash.” Those are useful smoke tests but not proof that a real user can complete a workflow.

**Required correction:** retain smoke tests, then add seeded, authenticated, deterministic golden-path tests with provider fakes and exact business assertions.

#### C. The design system is strong but not yet a complete product language

Tokens, type, colors, themes, shadows, and motion primitives exist. Missing pieces include:

- canonical component documentation and examples;
- page templates and density rules;
- data-visualization semantics;
- illustration/empty-state language;
- icon and brand-asset rules;
- motion choreography at the journey level;
- content design and terminology governance;
- visual regression and cross-theme evidence;
- high-contrast/system theme behavior;
- production screenshots using realistic Persian data.

#### D. The motion system exists in code but is inconsistently applied

`src/lib/motion.tsx` already defines duration, easing, page, list, popover, modal, and reduced-motion utilities. However, individual components still use ad-hoc transitions and infinite animations, while the app shell does not yet wrap content with the existing `MotionProvider`.

**Required correction:** finish #233 by making the existing motion system the only allowed motion vocabulary.

#### E. Roadmap truth is fragmented

`docs/04_ROADMAP.md` still describes older FastAPI/Celery assumptions and staffing/date estimates that no longer match the current Next.js/BullMQ modular monolith. Issue #160 covers production certification; #236 covers visual/responsive quality; #203–#222 cover benchmark features. No document currently unifies product strategy, dependencies, evidence, and release sequencing.

**Required correction:** use this document as the canonical product plan; keep #160 as the certification tracker; update or archive stale roadmap claims.

#### F. Provider breadth is ahead of provider proof

Provider names are visible, but support levels vary from certified to experimental. A 10/10 product must not let visual breadth imply equal capabilities.

**Required correction:** every provider surface must be generated from the capability registry and show:

- supported formats and limits;
- auth and permission health;
- analytics availability;
- publishing mode: direct, reminder, beta, or unavailable;
- rate-limit status;
- last verified time;
- incident/degradation status;
- certification evidence version.

---

## 4. World benchmark model

The target is a synthesis, not feature-for-feature imitation.

| Benchmark | World-class behavior to learn | Nashrino response |
|---|---|---|
| Buffer | Clear contexts for Create, Publish, Analyze, Community, and Start Page; queue simplicity; low cognitive load | Keep the core publishing loop radically simple; treat advanced controls as progressive disclosure |
| Hootsuite Social OS | Integrated publishing, care, listening, intelligence, analytics, and advocacy under a shared AI layer | Build a coherent operating model, but avoid enterprise breadth until validated by Persian customers |
| Sprout Social | Smart Inbox, reporting, listening, cross-domain intelligence, case management, and operational depth | Make Engage and Analyze credible team products, not secondary tabs |
| Later | Visual Instagram planning, visual media workflow, link-in-bio, creator/UGC workflows | Make visual planning and media preview a first-class differentiator |
| Planable | Feedback and approval on the content itself, multi-level workflows, universal marketing calendar | Bring comments, approvals, revision identity, and client sign-off into one content object |
| Metricool | Strong value, planning, analytics, reporting, smart links, ads, and practical automation | Deliver excellent reporting and utility for SMBs without enterprise complexity |
| Agorapulse | Unified inbox, assignment, saved replies, labels, SLA-like operations | Complete #207/#208 and add customer context and case history |
| SocialPilot | Bulk scheduling, agency/client management, white-label reports, practical pricing | Build agency operations and migration tools after core quality is proven |
| Canva-class creation | Direct manipulation, templates, brand kit, crops, visual confidence | Add focused media editing and brand governance, not a full design suite |
| Linear / Stripe / Vercel | High information density, speed, consistent primitives, restrained delight | Continue the current design-system direction while creating a distinct Nashrino identity |

### 4.1 Standards that define the release bar

- **Accessibility:** WCAG 2.2 AA, WAI-ARIA Authoring Practices, keyboard and screen-reader task tests.
- **Performance:** Core Web Vitals measured from real users: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at p75.
- **Security:** OWASP ASVS 5.0 L2, threat modeling, dependency/container/secret/code scanning, independent penetration testing.
- **AI governance:** NIST AI RMF 1.0 and the Generative AI Profile for risk, evaluation, monitoring, and human control.
- **Supply chain:** current stable SLSA specification, signed provenance, SBOM, immutable dependencies/actions where practical.
- **Delivery:** DORA software-delivery metrics and evidence of safe, repeatable releases.
- **Observability:** correlated traces, metrics, and logs using OpenTelemetry conventions.

---

## 5. Product positioning and target users

### 5.1 Positioning statement

> For Persian-speaking creators, brands, agencies, and social-care teams that need reliable multi-channel operations, Nashrino is the Persian-first social operating system that plans, publishes, engages, and reports across global and regional networks with correct RTL, Jalali time, local workflows, and transparent provider reliability.

### 5.2 Primary personas

#### Persona A — Owner/operator

- Runs one to five brands with a small team.
- Needs simple scheduling, content reuse, reminders, analytics, and local pricing.
- Success: connect and publish quickly; never wonder whether a post was actually sent.

#### Persona B — Content manager/editor

- Produces high volume across several channels.
- Needs drafts, per-channel variants, media organization, approvals, queues, and calendars.
- Success: less copying, fewer mistakes, faster review cycles.

#### Persona C — Approver/client

- Reviews content but should not navigate operational complexity.
- Needs an accurate preview, comments, change history, and explicit approval scope.
- Success: approve from mobile in under a minute with confidence about the exact revision.

#### Persona D — Community/support agent

- Handles DMs, comments, and mentions.
- Needs routing, ownership, saved replies, SLA visibility, customer context, and reliable source-channel replies.
- Success: no missed conversations, fast response, clear handoff.

#### Persona E — Agency administrator

- Operates many client workspaces and reports.
- Needs templates, imports, white-label outputs, client permissions, quotas, billing, and audit history.
- Success: onboard a client quickly and prove value without manual spreadsheets.

### 5.3 Jobs to be done

1. “Help me turn an idea into channel-correct content without repeating work.”
2. “Help my team know what is ready, blocked, approved, scheduled, live, or failed.”
3. “Publish at the right time and recover safely when networks or providers fail.”
4. “Put every audience conversation into an owned, measurable workflow.”
5. “Show what worked, why, and what to do next in language my team understands.”
6. “Respect Persian language, calendar, culture, billing, and regional platforms by default.”

---

## 6. Product principles

1. **Truth before delight.** Never say published when queued, connected when unverified, live when realtime is down, or supported when only a partial adapter exists.
2. **Fast path first.** The common action must be obvious; advanced controls appear when context requires them.
3. **One content object, many channel variants.** Preserve shared intent while making platform differences explicit.
4. **Failure is a designed state.** Every provider and network failure has a clear explanation, ownership, and next action.
5. **Persian is the source experience.** RTL, mixed-direction text, Jalali dates, Persian digits, local holidays, and Persian content quality are not localization afterthoughts.
6. **Motion explains.** Animation shows where something came from, where it went, what changed, or what is pending.
7. **Data must be actionable.** Every dashboard insight leads to a decision, filter, draft, reply, or report.
8. **Accessibility is interaction quality.** Keyboard, touch, screen reader, reduced motion, contrast, zoom, and drag alternatives are design constraints.
9. **Progressive power.** Solo users get simplicity; teams and agencies can unlock deeper workflows without making the base product heavy.
10. **Evidence closes work.** A screenshot, passing test, measured task, provider receipt, or production metric is required—not a checkbox alone.

---

## 7. Target information architecture

The current flat navigation is workable at today’s scope but will not scale cleanly as automation, listening, reports, and agency features arrive.

### 7.1 Recommended product areas

| Area | Purpose | Primary routes |
|---|---|---|
| Home | Operational command center and next actions | Dashboard, action center, recent activity |
| Create | Ideas, drafts, composer, templates, media | Create board, Compose, Content, Media |
| Plan | Calendar, queues, campaigns, grid planner | Calendar, Queues, Campaigns, Instagram Grid |
| Publish | Delivery status, failures, attempts, provider health | Publications, Queue health, DLQ, Channel health |
| Engage | Inbox, cases, saved replies, automations | Inbox, Assigned to me, SLA, Automation log |
| Analyze | Posts, campaigns, audience, reports, benchmarks | Analytics, Reports, Best times, Competitors |
| Automate | Rules, RSS/webhooks, comment-to-DM, recurring content | Automation builder, Rules, Runs |
| Govern | Brand kit, team, approvals, security, billing | Workspace, Members, Roles, Brand, Billing, Audit |

### 7.2 Navigation behavior

- Desktop: full labeled sidebar with collapsible sections and workspace switcher.
- Tablet: retain labels; do not reduce the product to unexplained icon-only navigation.
- Mobile: bottom navigation for Home, Create, Plan, Engage, More; preserve a prominent create action.
- Global command palette: search entities and execute actions, not only navigate.
- Context switcher: workspace/client, then optional channel filter.
- Deep links: every failed publication, inbox message, approval, report, and alert opens the exact relevant object.
- Role-aware navigation: hide unavailable actions, but preserve discoverability with “request access” or plan explanations where appropriate.

### 7.3 Dashboard redesign

The dashboard should answer five questions in order:

1. **Is anything broken or urgent?** Failed publications, expired credentials, overdue approvals, inbox SLA risk.
2. **What should I do next?** Ranked action center with one-click resolution.
3. **What is scheduled?** Today/next seven days with readiness and conflict indicators.
4. **How is performance changing?** A small number of decision-ready metrics with comparisons and provenance.
5. **What should we learn or create next?** Best-performing patterns, opportunities, and suggested actions.

Remove decorative metrics that do not lead to action. Every number needs a definition, timeframe, source, last-refresh time, and unavailable/partial-data state.

---

## 8. “Real design, not skeleton” program

### 8.1 Replace all demo signals with real contracts

Create and enforce a repository-wide rule: production components may not embed invented customer data.

**Required work:**

- Replace hard-coded workspace/user/plan/sidebar values with authenticated APIs.
- Replace external placeholder avatars with stored avatar, initials, or deterministic generated fallback.
- Bind realtime indicator to socket state, Redis adapter readiness, and last event time.
- Bind plan and usage meters to billing entitlements.
- Bind notification badges to real counts and explain stale/offline states.
- Ensure logout, workspace switching, notification buttons, and support links perform real actions.
- Add a CI script that scans production components for known fixture domains, demo names, placeholder metrics, and TODO-only actions.
- Keep demo/sample data only behind an explicit demo workspace mode.

### 8.2 Content realism

Design review must use a representative Persian content corpus:

- short and long captions;
- mixed Persian/English URLs, mentions, hashtags, emoji, phone numbers, and prices;
- single image, carousel, video, story/reel, text-only, and no-preview formats;
- long channel names and multiple connected instances;
- large counts, zero counts, partial analytics, expired tokens, provider incidents, and failed jobs;
- user-generated messages containing bidi edge cases;
- Jalali boundaries, leap years, DST/time-zone differences, Nowruz, Ramadan, Yalda, and official holidays.

### 8.3 Design artifact requirements

For every major feature, the PR or linked issue must include:

- problem statement and user evidence;
- flow diagram;
- high-fidelity light and dark designs;
- phone, tablet, desktop, and wide layout;
- loading, empty, error, offline, permission, plan-limit, and partial-provider states;
- keyboard path and screen-reader labels;
- reduced-motion behavior;
- analytics events;
- visual regression snapshots;
- before/after screenshots populated with realistic Persian content.

---

## 9. Visual identity and theme roadmap

### 9.1 Brand identity

The product needs a recognizable identity beyond a violet accent and the letter “N.”

Deliverables:

- final Persian and Latin wordmarks;
- product mark that works at 16px, app-icon size, and monochrome;
- brand usage guide;
- illustration direction inspired by publishing, signal, rhythm, calendar, and conversation—not generic gradients or random blobs;
- launch, onboarding, empty-state, success, and error illustration set;
- product screenshot art direction for marketing and help content;
- favicon, PWA icons, social cards, email header, report cover, and invoice assets.

### 9.2 Theme system

Support four resolved modes:

1. Light.
2. Dark.
3. System.
4. High contrast.

Rules:

- Keep semantic tokens as the only source for product color.
- Use platform colors only for identification, never as the sole status signal.
- Preserve neutral, solid content surfaces; reserve glass for navigation/overlays.
- Define chart palettes for categorical, sequential, diverging, positive/negative, and provider series.
- Validate contrast for normal, hover, active, selected, disabled, focus, chart labels, and overlays.
- Add forced-colors and high-contrast testing.
- Allow a controlled workspace brand accent only in reports/client portals; do not let customer branding damage application accessibility.

### 9.3 Typography

- Keep Vazirmatn as the Persian UI foundation and a compatible Latin fallback.
- Create named roles: display, page title, section title, body, label, caption, data, code.
- Test connected Persian glyphs, ZWNJ, Arabic/Persian digit variants, tabular numerals, and mixed-direction selection.
- Do not use sub-10px text for meaningful information.
- Use truncation only when the full value is available through accessible disclosure.
- Standardize numeric abbreviations for Persian and English display contexts.

### 9.4 Spacing, density, and layout

Offer deliberate density rather than arbitrary compression:

- Comfortable: default for creators and new users.
- Compact: optional for inbox, operations, tables, and agency users.
- Touch layouts keep at least a 44px practical target even where WCAG’s minimum is lower.
- Use container queries for reusable panels when their layout depends on available panel width rather than viewport width.
- Replace remaining layout-height assumptions with content-driven or bounded `min/max` behavior.
- Define page templates for overview, split-pane, table/list, editor+preview, calendar, settings, and report builder.

### 9.5 Data visualization

Create a chart design standard:

- show metric definition, date range, source, last update, comparison, and confidence;
- never rely on color alone;
- preserve readable axes in Persian and mixed digits;
- offer data table equivalents;
- support loading, insufficient-data, partial-provider, and data-delay states;
- use direct labels where possible rather than detached legends;
- avoid chart animation after initial context unless it explains a filter change;
- permit export with RTL-safe layout and consistent colors.

---

## 10. Motion and animation system

Motion should make Nashrino feel responsive and coherent, not busy.

### 10.1 Motion categories

| Category | Purpose | Typical behavior |
|---|---|---|
| Micro-feedback | Confirm press, selection, save, copy, retry | 80–150ms, opacity/scale, no layout movement |
| State transition | Loading → content, draft → queued, queued → live | 150–250ms, crossfade or small directional movement |
| Spatial continuity | Open editor, sheet, detail pane, calendar item movement | Shared origin, transform/opacity only |
| Attention | New failure, SLA risk, connection loss | One restrained entrance; no perpetual pulse |
| Progress | Upload, publish attempt, report generation | Determinate where possible; staged status when not |
| Celebration | First publish, recovered failed job, completed onboarding | Brief and rare; disabled for reduced motion |

### 10.2 Required implementation

Complete #233 by:

- wrapping the authenticated app in the existing `MotionProvider`;
- using `src/lib/motion.tsx` as the only JS timing/easing source;
- mapping CSS transitions to the same tokens;
- replacing hand-written page entrances with one `PageTransition` primitive;
- gating or removing all `repeat: Infinity` animations;
- stopping hidden/offscreen animation work;
- using `AnimatePresence` only when exit state improves understanding;
- ensuring overlays preserve Radix focus management and escape behavior;
- avoiding width/height/top/left animation when transform/opacity works;
- adding reduced-motion E2E tests;
- adding performance checks for long animation frames and INP regression.

### 10.3 Journey choreography

#### Composer

- Channel selection smoothly updates limits and previews without moving the user’s text cursor.
- Autosave state changes through subtle icon/text transitions, never blinking status.
- Media reorder uses direct manipulation with keyboard alternatives.
- Publish action moves through validating → queued → provider processing → confirmed, with a persistent activity record instead of a disappearing toast.

#### Calendar

- Dragging shows a ghost, target time, time-zone context, and conflict state.
- Drop animates to the committed slot only after optimistic validation; rollback clearly returns the item and explains why.
- Keyboard and tap “Move” actions provide the same capability without drag.

#### Inbox

- Assignment and status changes preserve the selected conversation.
- New messages appear without shifting the reader unexpectedly.
- SLA warnings use one entrance and stable visual priority, not continuous animation.

#### Analytics

- Filter changes preserve chart context; axes do not dramatically remount.
- Insight cards explain what changed and link to contributing posts.

---

## 11. End-to-end UX redesign by journey

### 11.1 First-run onboarding

**New P0 feature: Guided activation.**

Flow:

1. Choose role and primary objective.
2. Create/import workspace; set timezone, locale, work week, and brand basics.
3. Connect one provider with clear requirements and permission scopes.
4. Verify provider capability and health.
5. Import recent content/analytics where available.
6. Create the first post from a template or recent successful content.
7. Preview per channel.
8. Publish or schedule.
9. Show provider confirmation and explain where to monitor status.

Requirements:

- resumable onboarding;
- invitation path for teammates;
- provider-specific checklists;
- sample/demo workspace optional but clearly labeled;
- progress based on completed outcomes, not page visits;
- no blocking product tour that covers the interface;
- event instrumentation for every drop-off step;
- median first successful publish ≤5 minutes for a prepared account.

### 11.2 Channel connection and health

- Preflight explains account type, required permissions, supported formats, and review status.
- OAuth return shows exactly what was connected.
- Credential health includes expiry, scopes, last check, last successful publish, current incident, and reconnect action.
- Multiple channel instances of the same provider are easy to distinguish.
- Degraded providers remain usable where safe and show affected features.
- Connection diagnostics produce a support bundle without exposing secrets.

### 11.3 Compose

The target composer should feel like one calm workspace, not a long form.

Recommended structure:

- Sticky header: title, save state, owner, approval state, primary action.
- Main editor: shared content and media.
- Channel strip: connected destinations, warnings, support levels.
- Preview pane: exact channel rendering and per-channel overrides.
- Inspector: campaign, tags, approval, schedule/queue, tracking, accessibility, internal notes.
- Mobile: one-column editor with a persistent preview/schedule bottom sheet.

Add:

- per-channel variants with clear inheritance/reset;
- alt text and accessibility checks;
- link metadata and UTM builder;
- first-comment support where provider permits;
- hashtag/snippet groups;
- template and brand-voice selection;
- best-time suggestions with confidence and evidence;
- conflict-aware autosave and visible revision history;
- validation summary that jumps to each problem;
- “send test/reminder” modes where direct publishing is unavailable;
- one-tap reopen/fix from failed publication.

### 11.4 Planning and queue

- Month, week, day, agenda, and channel-lane views.
- Per-channel recurring slots and queue ordering.
- Drag, keyboard, and tap alternatives.
- Holiday/occasion overlays with opt-out.
- Capacity/conflict indicators.
- Readiness state: idea, draft, needs changes, awaiting approval, ready, scheduled, publishing, live, failed.
- Filters have shareable URLs.
- Bulk select supports safe reschedule, campaign assignment, approval submission, and deletion.

### 11.5 Approval and collaboration

**New P1/P2 feature expansion beyond current single-level review:**

- comments attached to the post or exact text/media region;
- mention and resolve threads;
- revision comparison in Persian;
- approval tied to immutable revision ID;
- configurable stages: internal, legal, client, final;
- due dates and reminders;
- lock after approval, with explicit unlock reason;
- mobile guest approval link with optional authentication;
- client portal with only relevant content;
- audit export.

### 11.6 Inbox and customer care

- Three-pane desktop layout: queues, conversation list, thread/context.
- Mobile uses list → thread navigation with preserved filters.
- Unified conversation identity across comments/DMs where provider rules allow.
- Ownership, status, priority, tags, SLA, sentiment/intent, and customer history.
- Saved replies with variables, approval rules, and usage analytics.
- Collision detection when another agent is typing/replying.
- Internal notes separate from external replies.
- Provider reply constraints visible before send.
- Failed replies remain editable and retryable.
- Case escalation and handoff.
- Customer profile timeline and consent/opt-out state.

### 11.7 Analytics and reporting

Organize Analyze into:

1. Overview: executive outcomes and anomalies.
2. Content: post-level performance and patterns.
3. Audience: growth, active times, demographics where available.
4. Campaigns: goals, spend, UTM results, and ROI.
5. Care: first response, resolution, SLA, volume, quality.
6. Publishing operations: success, lateness, retries, provider errors.
7. Reports: reusable, scheduled, shared.
8. Benchmarks/listening: later gate.

Every AI-generated insight must provide:

- source metrics and date range;
- confidence/coverage;
- provider limitations;
- action link;
- feedback controls;
- no invented causal claim.

### 11.8 Settings and governance

Split settings into clear domains:

- Workspace profile.
- Brand kit.
- Channels and integrations.
- Team and roles.
- Approval workflows.
- Notifications.
- Calendar/timezone/localization.
- Security and sessions.
- Billing and usage.
- Data/privacy/export/retention.
- API/webhooks.
- Audit log.

Settings changes that affect publishing or security must show impact, require appropriate permission, and create an audit event.

---

## 12. Existing work: reconcile and finish

The following open issues already represent important work. They should be folded into the gate plan rather than duplicated.

### 12.1 Foundation, certification, and technical debt

| Issue | Work | Priority | Exit evidence |
|---|---|---:|---|
| #200 | Remove remaining route-handler grace list | P0 | All handlers <100 lines; architecture test has no grace list |
| #201 | 72h soak and DR game-day execution | P0 | Committed timings, dashboards, no-loss/no-duplicate evidence |
| #202 | OWASP ASVS assessment | P0 | ASVS 5.0 L2 matrix; critical/high findings closed |

**Correction:** update #202 from ASVS 4.x to the current stable ASVS 5.0.0 baseline before execution.

### 12.2 Planning and publishing parity

| Issue | Work | Priority | Key dependency |
|---|---|---:|---|
| #203 | Per-channel queue slots | P0 | Publication scheduling model |
| #204 | Best-time suggestions | P1 | Analytics history + #203 |
| #205 | Bulk CSV scheduling | P1 | Validation/import service + #203 |
| #206 | Calendar week/day + reschedule audit | P0 | #203 and accessible move action |
| #219 | Instagram grid preview | P1 | Reliable media thumbnails + IG account data |
| #222 | Jalali holidays and work-week semantics | P0 moat | Calendar + queue model |

### 12.3 Engage and automation

| Issue | Work | Priority | Key dependency |
|---|---|---:|---|
| #207 | Saved replies and auto-tagging | P1 | Inbox module |
| #208 | Routing, status, SLA, resolution | P0 | Realtime + case model |
| #209 | Compliant comment-to-DM | P1 | Meta review, policy engine, audit trail |

### 12.4 Content, media, and governance

| Issue | Work | Priority | Key dependency |
|---|---|---:|---|
| #210 | Media folders, tags, search, reuse, alt text | P0 | Media module and search |
| #211 | Crop presets and RTL text overlay | P1 | #210 and #213 |
| #212 | Content revisions and restore | P0 | Immutable approval revision IDs |
| #213 | Brand kit and voice governance | P0 | Workspace settings |

### 12.5 Analytics, access, and business

| Issue | Work | Priority | Key dependency |
|---|---|---:|---|
| #214 | PDF/CSV report builder | P1 | Analytics taxonomy + RTL export engine |
| #215 | Per-post analytics and campaign rollup | P0 | Provider insight ingestion |
| #220 | PWA/offline compose/push | P1 | Responsive quality and sync conflict model |
| #221 | IRR billing, quotas, local gateway | P0 for commercial GA | Entitlements, invoices, dunning |

### 12.6 UI/UX quality completion

| Issue | Work | Priority | Exit evidence |
|---|---|---:|---|
| #232 | 44px practical target in primitives; focus unification | P0 | Automated mobile target audit |
| #233 | Global motion/reduced-motion system | P0 | No ungated infinite animation; reduced-motion E2E |
| #234 | Loading/empty/error/offline coverage | P0 | State matrix complete for every async surface |
| #235 | Visual regression and raised budgets | P0 | Baselines green in light/dark across core widths |
| #237 | Tailwind/dependency/dead utility cleanup | P1 | Build green; no dead configuration |

### 12.7 Tracker hygiene

- Update #236 checkboxes to reflect merged work in #223–#231.
- Link each open issue to the gate in this plan.
- Close duplicate/stale issues rather than maintaining parallel roadmaps.
- Update `docs/CURRENT_STATUS.md` from generated evidence, not manual claims.

---

## 13. New features required for true world-class parity

The existing backlog is strong but does not cover several capabilities that leading products now treat as core.

### 13.1 P0 new features

#### A. Real account/workspace shell

Replace every demo identity and no-op shell control with real data/actions. This is the first “not a skeleton” gate.

#### B. Guided onboarding and migration

- provider preflight and connection wizard;
- CSV/content import;
- optional import from common competitors where export formats allow;
- invite teammates;
- activation checklist tied to outcomes;
- resumable state and funnel analytics.

#### C. UTM, short links, and click attribution

- workspace tracking presets;
- per-campaign and per-channel UTM defaults;
- link preview and validation;
- optional first-party short domain;
- click event ingestion and campaign attribution;
- privacy-safe reporting and bot filtering.

#### D. In-context approval comments

Current review states need a Planable-class collaboration layer: comments, mentions, resolved threads, exact revision identity, and mobile client approval.

#### E. Product analytics and feature flags

- privacy-reviewed event schema;
- activation, adoption, retention, and task-failure funnels;
- feature flags separated from billing entitlements;
- experiment assignment and guardrails;
- no sensitive content in analytics payloads.

#### F. Help, support, and status surfaces

- Persian help center;
- contextual help and provider requirement pages;
- public status page with provider-level incidents;
- support bundle and request flow;
- release notes and in-product “what changed”;
- operational contact and security disclosure policy.

### 13.2 P1 new features

#### G. Link-in-bio / Smart Page

A practical growth feature and direct benchmark response to Buffer/Later/Metricool:

- branded RTL page builder;
- blocks for links, products, latest posts, contact, and tracking;
- custom domain;
- themes from brand kit;
- click analytics;
- accessibility and fast static delivery.

#### H. Social listening and alerting foundation

- keyword/topic monitoring where provider/data contracts allow;
- mentions, brand terms, competitor names, campaign tags;
- noise filters and language detection;
- spike/anomaly alerts;
- saved searches;
- source and coverage transparency;
- human-verified Persian sentiment before automation.

#### I. Customer profile and case management

Extend Inbox into a care workspace:

- customer/contact profile;
- interaction timeline;
- tags, notes, consent, opt-out;
- linked cases and outcomes;
- merge duplicate identities with audit trail;
- export/delete controls.

#### J. Automation builder

Beyond comment-to-DM:

- triggers: schedule, RSS, webhook, keyword, status, provider event, date/holiday;
- conditions: channel, tag, campaign, time, sentiment/intent, approval;
- actions: create draft, queue, notify, assign, reply, add tag, call webhook;
- dry run, versioning, run history, idempotency, rate limits, pause/kill switch;
- human approval for high-risk AI actions.

#### K. Agency/client operations

- multi-client workspace switcher;
- client-specific roles and guest approvals;
- reusable workspace templates;
- white-label reports and client portal;
- agency overview for risks, approvals, usage, and renewals;
- bulk user/channel administration.

#### L. Public API, outbound webhooks, and integrations

- scoped API tokens;
- OpenAPI documentation;
- content/publication/inbox/report endpoints;
- signed outbound webhooks with retries and replay;
- integration recipes for Zapier/Make/n8n;
- rate limits, audit events, and revocation.

### 13.3 P2 new features

#### M. Persian content intelligence

- content brief and weekly idea board;
- trend/occasion suggestions;
- repurpose long-form content into channel variants;
- Persian tone, grammar, half-space, banned-word, and brand-voice checks;
- hashtag research with confidence and source date;
- content gap analysis from historical performance;
- human feedback and evaluation datasets.

#### N. Competitor benchmarking and share of voice

Only after listening quality is proven:

- competitor profiles and tracked topics;
- comparable public metrics;
- share of voice and trend movement;
- transparent source coverage;
- no false precision where data access is incomplete.

#### O. Influencer/UGC workflow

- collect permissioned UGC;
- creator/contact records;
- rights status and expiry;
- attach assets to campaigns;
- creator performance reporting;
- no marketplace until demand is validated.

#### P. Enterprise governance

- SSO/OIDC/SAML;
- SCIM provisioning;
- custom roles;
- IP/session controls;
- audit export and retention policies;
- legal hold/data residency options;
- approval policy templates;
- enterprise support and SLA.

#### Q. Native mobile application decision

Do not build native apps merely for parity. First ship and measure #220. Consider React Native/native only when PWA data proves recurring needs that browser constraints cannot satisfy, such as reliable background upload, richer push, camera workflows, or app-store distribution outside restricted markets.

---

## 14. AI product and governance plan

AI must be useful, measurable, and controlled.

### 14.1 User-facing AI capabilities

- Caption and channel-variant generation.
- Hashtag and keyword suggestions.
- Brand voice and banned-word checks.
- Best-time recommendation.
- Content ideas and occasion prompts.
- Summarize inbox/campaign performance.
- Suggested replies with source conversation context.
- Report narratives with metric citations.
- Automation assistance, never silent autonomous publishing by default.

### 14.2 Required AI controls

- Workspace opt-in and role permissions.
- Clear indication when content is AI-generated or AI-edited.
- Provider-required AI disclosure fields.
- Prompt/template versioning.
- Model/provider registry and fallback policy.
- PII and secret redaction.
- Content retention settings and vendor contract review.
- Cost, latency, failure, and quality telemetry.
- Safety filters appropriate to user-generated content.
- Human confirmation before publishing, external reply, destructive action, or policy-sensitive automation.
- Kill switch per feature/model/workspace.

### 14.3 Evaluation program

Create a Persian evaluation set covering:

- formal, friendly, promotional, support, and professional tones;
- mixed Persian/English brand names and hashtags;
- ZWNJ and punctuation quality;
- factual grounding from a supplied brief;
- hallucination and unsupported claims;
- brand guideline compliance;
- toxicity, harassment, self-harm, regulated content, and sensitive data;
- provider length and format compliance.

Release gates:

- task-specific quality rubric and human baseline;
- regression suite on every prompt/model change;
- acceptance rate, edit distance, time saved, user feedback, and harmful-output rate;
- no production claim of “best time” or “trend” without data provenance.

---

## 15. Engineering architecture needed to support the product

### 15.1 Complete the modular monolith

Finish #200 and enforce:

`Route → authorization/validation → application service → repository/provider → domain event`

Rules:

- UI and route handlers do not own business state transitions.
- Every mutating workflow has an idempotency strategy.
- Every important state transition emits an audit/domain event.
- Provider adapters expose capability, auth, publish, reply, analytics, and health contracts separately.
- Cross-module workflows use application services and outbox events, not direct repository imports.

### 15.2 Canonical domain model additions

Likely additions/refinements:

- `PostingSchedule` and queue position.
- `ContentRevision` and `ApprovalDecision(revisionId)`.
- `CommentThread`/review annotation.
- `BrandKit` and policy rules.
- `SavedReply`, `InboxTagRule`, `ConversationCase`, `SlaPolicy`.
- `TrackingLink`, `ClickEvent`, `CampaignGoal`.
- `ReportDefinition`, `ReportRun`, `SharedReport`.
- `AutomationDefinition`, version, run, step, and audit.
- `FeatureFlag`, `Entitlement`, `UsageLedger`.
- `OnboardingProgress` and import jobs.
- `AiGeneration`, model/prompt version, feedback, and cost metadata.
- `ProviderCertification` with evidence SHA/date/capability version.

### 15.3 Design system architecture

- Keep semantic tokens in CSS as the source of truth.
- Add a component workbench such as Storybook or an equivalent route in the app.
- Document every primitive with states, RTL, themes, keyboard behavior, and examples.
- Add interaction tests for primitives.
- Add visual snapshots for primitives and page templates.
- Create lint rules for raw colors, arbitrary type, physical direction, unapproved motion, and direct fixture imports.
- Add an accessibility test helper that checks axe, target size, focus order, and modal focus return.

### 15.4 Provider certification framework

For every capability/provider pair, store evidence for:

- auth and token refresh;
- content types and limits;
- direct vs reminder publishing;
- scheduled delivery;
- duplicate behavior;
- retry safety and unknown outcomes;
- rate limits;
- media processing;
- analytics fields and delay;
- inbox read/reply;
- webhook signatures and replay;
- permission revocation;
- sandbox/test account and last verified API version.

UI support badges must be derived from this registry, not hand-authored labels.

### 15.5 Product telemetry

Create a governed event taxonomy:

- `onboarding_started/completed`;
- `channel_connect_started/succeeded/failed`;
- `draft_created/autosave_conflict`;
- `preview_opened/validation_failed`;
- `approval_submitted/approved/rejected`;
- `publication_queued/provider_confirmed/failed/recovered`;
- `inbox_assigned/replied/resolved/sla_breached`;
- `report_created/shared/exported`;
- `ai_suggestion_generated/accepted/edited/rejected`;
- `billing_checkout_started/succeeded/failed`.

Every event needs owner, schema, privacy classification, retention, and dashboard use. Do not log captions, DMs, tokens, or personal data unless explicitly necessary and protected.

---

## 16. Quality strategy

### 16.1 Test layers

1. **Unit/domain:** state machines, permissions, date/time, capability validation, billing, AI policy.
2. **Contract:** API envelopes, provider fixtures, webhook signatures, compatibility by API version.
3. **Integration:** PostgreSQL, Redis/BullMQ, outbox, realtime, object storage, local gateway sandbox.
4. **Component:** interactions, keyboard behavior, themes, RTL, error states.
5. **E2E:** authenticated golden paths with deterministic seed data and provider simulators.
6. **Visual:** representative routes, states, themes, breakpoints, Persian content.
7. **Accessibility:** axe plus manual keyboard/screen-reader/zoom/reduced-motion tests.
8. **Performance:** bundles, synthetic Lighthouse, k6, browser traces, and real-user monitoring.
9. **Chaos/DR:** worker kill, Redis loss, provider timeout, duplicated webhook, DB restore, mixed deployment.
10. **Security:** SAST, dependency, secret, container, ASVS, threat model, penetration test.

### 16.2 Golden-path E2E suite

Tests must use a seeded authenticated workspace and assert business outcomes:

1. Sign in with MFA and accessible authentication.
2. Connect a provider test account and verify capability state.
3. Create content with media, per-channel variants, alt text, and UTM.
4. Save, refresh, restore, and resolve a concurrent draft conflict.
5. Submit for approval; comment; revise; approve exact revision.
6. Add to queue and move using drag, keyboard, and tap alternatives.
7. Publish through worker; observe queued → processing → confirmed.
8. Inject provider timeout; reconcile unknown outcome without duplicate.
9. Open failed publication, fix, and retry.
10. Receive inbox item, assign, use saved reply, reply, resolve, stop SLA.
11. Generate and export a Jalali RTL report.
12. Complete billing checkout/renewal failure/grace behavior in sandbox.
13. Work offline in PWA draft mode and synchronize without data loss.

### 16.3 Visual matrix

At minimum:

- widths: 360, 375, 414, 768, 1024, 1280, 1440/1600;
- themes: light, dark, high contrast;
- density: comfortable, compact where supported;
- states: realistic populated, empty, loading, error, offline, permission denied, plan limited;
- pages: shell, dashboard, compose, calendar, content, media, inbox, analytics, channels, settings, billing, approval link.

Dynamic values must be seeded or masked deliberately; snapshots must not be made meaningless by masking the whole page.

### 16.4 Accessibility release gate

- WCAG 2.2 AA automated and manual review.
- 200% and 400% zoom/reflow.
- Keyboard-only golden paths.
- Voice-control-friendly accessible names.
- Screen-reader test on at least NVDA/Firefox or Chrome and VoiceOver/Safari.
- Drag alternatives.
- Focus visible, logical, trapped in modal, and returned on close.
- 44px practical touch targets on mobile.
- Reduced-motion and no flashing/perpetual attention animation.
- Mixed-direction content and editor cursor/selection tests.
- Charts have text/table alternatives.

### 16.5 Performance budgets

Field p75 target:

- LCP ≤2.5s.
- INP ≤200ms.
- CLS ≤0.1.

Product-specific budgets:

- route transition feedback begins ≤100ms;
- command palette opens ≤100ms after input on reference hardware;
- composer keystrokes remain responsive with long Persian content and ten media items;
- optimistic local acknowledgement ≤100ms;
- non-cached dashboard useful content ≤2.5s on target mobile network;
- lazy-load heavy chart/editor/media modules;
- no animation task >50ms;
- no unbounded queries or lists.

Lighthouse is a CI signal, not the final proof. Add real-user web-vitals by route, device class, geography/network, and release SHA.

---

## 17. Reliability, security, privacy, and operations

### 17.1 Reliability targets

- Publish acceptance availability: 99.9%+ monthly.
- Provider-adjusted confirmed publish success: ≥99.5% for certified providers.
- Duplicate external publications caused by Nashrino: zero target; any occurrence is a severity-one incident.
- Scheduled attempt lateness: p95 ≤30s, p99 ≤120s where provider/network permits.
- Unknown outcomes reconciled within a defined provider-specific window.
- Inbox ingest lag and reply success SLOs by provider.
- RPO ≤15 minutes and RTO ≤1 hour for launch, then improve based on business need.

### 17.2 Security program

- Update #202 to OWASP ASVS 5.0 L2.
- Threat-model auth, workspace isolation, provider OAuth, webhook ingest, media processing, AI, billing, public sharing, API tokens, and automation.
- Add `SECURITY.md`, supported-version policy, and private disclosure route.
- Pin GitHub Actions to immutable SHAs with automated update tooling.
- Sign releases/images and publish verifiable provenance/SBOM.
- Enforce branch protection, required reviews, CODEOWNERS, and least-privilege workflow permissions.
- Add dependency update automation and explicit risk expiry for accepted vulnerabilities.
- Independent penetration test before commercial GA.
- Session/device management and security notifications.
- Secret rotation drills and emergency provider-token revocation.

### 17.3 Privacy and data governance

- Data inventory and classification.
- Workspace retention controls.
- User/customer export and deletion workflows.
- Audit-log retention and access.
- Minimize content sent to AI vendors; document model data usage.
- Consent and opt-out for automation.
- Public privacy policy, subprocessor list, and incident communication process.
- Do not claim residency or compliance certification without evidence.

### 17.4 Operational evidence

Complete #201 with:

- 72-hour staging soak;
- Postgres restore;
- Redis/BullMQ reconstruction from outbox;
- worker/app/realtime kill and restart;
- mixed-version deployment;
- provider timeout/rate-limit incident;
- rollback and forward-fix;
- alert-to-runbook drill;
- screenshots, timelines, traces, metrics, decisions, and follow-up issues committed to the repository.

---

## 18. Product and business metrics

### 18.1 North-star metric

**Weekly successful social outcomes per active workspace**, composed of:

- confirmed publications;
- resolved audience conversations;
- approved content items;
- consumed/shared reports that led to an action.

Do not use raw scheduled-post count as the sole north star; it rewards volume without quality or impact.

### 18.2 Activation

- Time to first connected verified channel.
- Time to first successful publish.
- Onboarding completion rate.
- Percent connecting a second channel or inviting a teammate in seven days.
- Provider connection failure rate by step/reason.

### 18.3 Engagement and retention

- Weekly active workspaces and active operators.
- Draft → scheduled → confirmed funnel.
- Queue, calendar, approval, inbox, report, and AI feature adoption.
- Four- and twelve-week workspace retention by persona/plan.
- Number of recurring workflows configured.

### 18.4 Quality and trust

- Publish success, duplicate, lateness, retry, and unknown-outcome rates.
- Draft conflict and data-loss rate.
- Failed reply rate.
- SLA breach rate.
- Support contacts per 1,000 outcomes.
- User-reported trust score: “I understand what Nashrino did and what will happen next.”

### 18.5 AI metrics

- Suggestion acceptance.
- Edit distance and time saved.
- Regeneration/rejection rate.
- Persian quality rubric.
- Grounding/citation coverage.
- Harmful or policy-invalid output rate.
- Cost and latency per accepted suggestion.

### 18.6 Commercial metrics

- Free/trial → paid conversion.
- Gross and net revenue retention.
- Expansion by channels/seats/workspaces.
- Payment failure and recovery.
- Support cost and infrastructure cost per active workspace.
- Agency/client activation and report-share rate.

---

## 19. Evidence-gated execution roadmap

Do not treat the durations below as promises. They are effort bands for sequencing and capacity planning. Each gate closes only with evidence.

### Gate 0 — Truth, safety, and canonical plan

**Goal:** make the repository, product shell, and release claims truthful.

**Work:**

- Adopt this plan as canonical.
- Reconcile #160, #236, `CURRENT_STATUS`, and stale roadmap documents.
- Complete #200, #201, #202.
- Replace hard-coded shell identity/status/plan/avatar and no-op controls.
- Add `SECURITY.md` and repository governance.
- Define product event taxonomy and feature-flag architecture.
- Establish exact provider certification records.

**Exit:**

- No production demo identity or false status.
- All docs describe current architecture.
- ASVS plan is current.
- Staging/DR evidence exists.
- Exact release artifact traceability is documented.

**Effort band:** 2–4 engineering weeks, partially parallel.

### Gate 1 — Premium experience foundation

**Goal:** make every existing surface feel intentional, accessible, and stable.

**Work:**

- Complete #232–#235 and #237.
- Add design-system workbench and component interaction tests.
- Implement real async state matrix.
- Finish global motion provider and page choreography.
- Add high-contrast/system themes and chart standard.
- Add visual regression matrix and real-user web vitals.
- Redesign dashboard around urgency and action.
- Build guided onboarding.

**Exit:**

- All golden routes pass responsive, theme, state, keyboard, reduced-motion, and visual gates.
- Usability test: first publish median ≤5 minutes.
- No unresolved P0 accessibility finding.
- Field or controlled beta Core Web Vitals meet target.

**Effort band:** 4–8 engineering weeks.

### Gate 2 — Publishing and planning superiority

**Goal:** match the strongest scheduling tools and exceed them for Persian workflows.

**Work:**

- #203, #204, #205, #206, #210, #211, #212, #213, #219, #222.
- UTM/link tracking.
- Templates, hashtag/snippet groups, alt text, per-channel variants.
- One-tap failure repair and resend.
- Provider certification for primary launch channels.

**Exit:**

- Queue, exact schedule, bulk import, calendar move, revision, media reuse, grid preview, and holiday workflows pass E2E.
- Certified provider success and lateness SLOs achieved in soak.
- No duplicate publication in fault-injection suite.
- User test: editors complete weekly planning faster than their current process.

**Effort band:** 8–14 engineering weeks.

### Gate 3 — Team collaboration and customer care

**Goal:** become a credible team system, not only a scheduler.

**Work:**

- #207, #208, #209.
- In-context comments, exact-revision approvals, configurable stages, guest/client approval.
- Customer profiles, internal notes, collision detection, case management.
- Automation policy engine and audit.

**Exit:**

- Approval and inbox golden paths pass with role boundaries.
- SLA and ownership are measurable.
- Comment-to-DM policy tests and Meta review evidence exist.
- Agents resolve conversations without switching tools in target scenarios.

**Effort band:** 8–14 engineering weeks.

### Gate 4 — Intelligence, analytics, and growth

**Goal:** turn operational data into decisions and growth actions.

**Work:**

- #214 and #215.
- AI governance/evaluation program.
- Link-in-bio Smart Page.
- Listening foundation.
- Persian idea/trend/occasion intelligence.
- Campaign objectives, attribution, and report sharing.

**Exit:**

- Reports are accurate, exportable, shareable, RTL/Jalali correct.
- AI insights cite source data and pass Persian evaluation thresholds.
- Customers can move from insight to draft/action in one flow.
- Listening coverage and limitations are documented.

**Effort band:** 8–16 engineering weeks.

### Gate 5 — Commercial and agency readiness

**Goal:** support sustainable paid operation and multi-client teams.

**Work:**

- #220 and #221.
- Entitlements and usage ledger.
- Agency overview, client portal, white-label reports.
- Public API/webhooks/integration recipes.
- Migration/import tools.
- Dunning, invoices, refunds/support procedures.

**Exit:**

- Billing and quota behavior pass sandbox and failure tests.
- PWA install/offline/push golden paths pass.
- Agency can onboard a client and share an approved report without manual support.
- Privacy/export/delete and support processes are operational.

**Effort band:** 8–14 engineering weeks.

### Gate 6 — World-class certification

**Goal:** independently demonstrate the 10/10 claim.

**Required evidence:**

- usability study and benchmark-task report;
- accessibility audit and remediation;
- penetration test and remediation;
- provider certification matrix;
- 72-hour soak and DR evidence;
- field performance report;
- visual regression report;
- DORA and SLO dashboard history;
- product activation/retention evidence;
- support/privacy/status readiness;
- exact release SHA and signed artifact provenance.

**Exit:** the release scorecard below is ≥95/100 with no critical category below its minimum.

---

## 20. Prioritization rules

Use a modified RICE/WSJF model, but apply non-negotiable multipliers.

### 20.1 Priority formula

`Priority = (Reach × User impact × Strategic differentiation × Confidence × Risk reduction) / Effort`

Then apply:

- **P0 override:** security, data loss, duplicate publishing, false status, accessibility blocker, provider-policy violation, billing correctness.
- **Moat multiplier:** RTL/Jalali/local provider/Persian AI/local payment features receive extra strategic weight when customer evidence supports them.
- **Evidence penalty:** low-confidence feature requests cannot outrank measured activation or reliability failures.
- **Complexity tax:** broad enterprise or AI features require a discovery spike and kill criteria before implementation.

### 20.2 Stop rules

Stop or redesign a feature when:

- fewer than 20% of the target cohort adopts it after appropriate discovery/onboarding;
- it increases task time or error rate;
- provider access cannot support a truthful product claim;
- AI quality remains below human acceptance thresholds;
- maintenance/support cost exceeds expected value;
- a simpler workflow achieves the outcome.

---

## 21. Delivery operating model

### 21.1 Dual-track product development

- **Discovery:** customer interviews, workflow observation, prototype, usability, feasibility, data/policy checks.
- **Delivery:** implementation, tests, migration, telemetry, docs, rollout, evidence.

No major feature enters delivery with only a competitor screenshot as justification.

### 21.2 Issue template for product work

Every epic/issue must include:

1. User/problem and target persona.
2. Evidence and baseline metric.
3. Benchmark/reference behavior.
4. Scope and non-goals.
5. Flow and state matrix.
6. Provider/data/security/privacy constraints.
7. Accessibility and reduced-motion behavior.
8. Analytics events and success metric.
9. Test/evidence plan.
10. Rollout, feature flag, migration, rollback.
11. Documentation/support impact.
12. Definition of done.

### 21.3 Pull-request evidence

A product PR is not complete without:

- screenshots/video for affected layouts/themes;
- tests at the correct layer;
- accessibility notes;
- telemetry changes;
- schema migration and rollback notes when applicable;
- provider capability update;
- docs/help update;
- no new hard-coded fixtures;
- measured performance impact;
- linked issue acceptance criteria checked with evidence.

### 21.4 Release model

- Small, reviewable changes behind flags.
- Preview environment per PR for product review.
- Canary cohort before broad rollout.
- Automatic rollback for technical health; explicit kill switch for product/AI/provider features.
- Release notes grouped by user outcome.
- Post-release metric review after 24 hours, 7 days, and 28 days.

---

## 22. 100-point world-class scorecard

| Category | Points | Minimum to certify | Evidence |
|---|---:|---:|---|
| Core user journeys and activation | 12 | 10 | Moderated tests, funnel data, golden E2E |
| Visual design and responsive quality | 10 | 9 | Design review, visual matrix, real content |
| Interaction, motion, and accessibility | 10 | 9 | WCAG audit, keyboard/SR/reduced-motion tests |
| Publishing reliability and provider truth | 12 | 11 | Soak, certification, duplicate/lateness metrics |
| Planning, content, and media workflow | 8 | 7 | Queue/calendar/media/revision E2E |
| Collaboration and inbox operations | 8 | 7 | Approval/SLA/case workflow evidence |
| Analytics, reporting, and intelligence | 8 | 7 | Metric validation, report accuracy, AI evals |
| Security, privacy, and supply chain | 10 | 9 | ASVS, pentest, threat models, provenance |
| Performance and scalability | 8 | 7 | Field vitals, load tests, capacity evidence |
| Operations and disaster recovery | 6 | 6 | SLO history, drills, runbook game days |
| Business, billing, support, and governance | 5 | 4 | Billing tests, status/help/privacy/support readiness |
| Regional differentiation | 3 | 3 | RTL/Jalali/local providers/Persian AI evidence |
| **Total** | **100** | **95 overall** | No critical category below minimum |

A score of 10/10 is awarded only when:

- total ≥95;
- security/privacy, reliability/provider truth, accessibility, and DR meet their minimums;
- no open P0 defect;
- the exact release candidate owns the evidence;
- at least one external review validates accessibility/security or usability claims.

---

## 23. Immediate next actions

### Next 10 actions in dependency order

1. Merge this plan and mark it canonical.
2. Update #236 status and link #232–#237 to Gate 1.
3. Create a P0 issue to remove hard-coded shell user/workspace/plan/avatar/live status and wire real actions.
4. Update #202 to ASVS 5.0 and begin the assessment.
5. Execute #201 and commit evidence.
6. Complete #232/#233/#234/#235 before adding more surface area.
7. Create guided onboarding discovery and prototype; run five user tests.
8. Finalize the queue/calendar domain design for #203/#206/#222.
9. Finalize immutable revision/approval design for #212 and in-context comments.
10. Instrument activation, publish trust, and task-failure metrics before the next broad beta.

### Suggested new GitHub issues

- `[P0][UX] Replace demo shell identity/status with authenticated product data`
- `[P0][Product] Guided onboarding and first-publish activation funnel`
- `[P0][Design System] Component workbench, page templates, and chart standard`
- `[P0][Collaboration] In-context comments and exact-revision approval`
- `[P0][Growth] UTM presets, short links, and click attribution`
- `[P0][Platform] Product analytics event taxonomy and feature flags`
- `[P0][Launch] Persian help center, status page, support bundle, SECURITY.md`
- `[P1][Growth] RTL link-in-bio Smart Page`
- `[P1][Engage] Customer profiles and case management`
- `[P1][Automation] Versioned workflow builder with run history and kill switch`
- `[P1][Agency] Multi-client overview, client portal, workspace templates, white-label reports`
- `[P1][Platform] Public API, signed webhooks, and integration recipes`
- `[P1][Intelligence] Social listening foundation and spike alerts`
- `[P2][AI] Persian content intelligence evaluation and feedback program`
- `[P2][Analyze] Competitor benchmarking and share of voice`
- `[P2][Enterprise] SSO/SCIM/custom roles/session policies/audit export`

---

## 24. Definition of done for the plan itself

This plan is considered adopted when:

- it is merged into `main`;
- #160 links it as the product-quality companion to certification;
- #236 is reconciled with completed work;
- stale architecture and staffing assumptions in older roadmaps are corrected or marked historical;
- every open benchmark feature issue is assigned to a gate;
- new P0 issues are created for the real-shell, onboarding, collaboration, tracking, telemetry, and launch-support gaps;
- the scorecard is reviewed at each release candidate.

---

## 25. Research sources

### Current product benchmarks

- Hootsuite Social OS: https://www.hootsuite.com/whats-new/social-os
- Hootsuite platform: https://www.hootsuite.com/platform
- Hootsuite Wisdom: https://www.hootsuite.com/wisdom-ai
- Sprout Social 2026 AI intelligence announcement: https://sproutsocial.com/insights/press/sprout-social-unveils-its-ai-powered-social-intelligence-platform-and-the-expansion-of-its-proprietary-ai-agent-trellis/
- Sprout Listening: https://sproutsocial.com/features/social-media-listening/
- Buffer Create: https://buffer.com/create
- Buffer dashboard contexts: https://support.buffer.com/article/946-navigating-buffers-new-dashboard
- Buffer Analyze: https://support.buffer.com/article/521-instagram-metric-descriptions
- Planable product: https://planable.io/product/
- Planable Universal Content: https://planable.io/universal-content/
- Planable approval guide: https://planable.io/guides/content-approvals-in-planable/
- Later visual planner: https://later.com/visual-instagram-planner/
- Metricool features: https://metricool.com/features/
- Agorapulse social inbox: https://www.agorapulse.com/features/social-media-inbox/
- SocialPilot features: https://www.socialpilot.co/features

### Standards and quality references

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- New in WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
- Core Web Vitals: https://web.dev/articles/vitals
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- OWASP ASVS repository: https://github.com/OWASP/ASVS
- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework
- NIST Generative AI Profile: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- SLSA specification: https://slsa.dev/spec/v1.2/
- OpenTelemetry: https://opentelemetry.io/docs/
- DORA metrics: https://dora.dev/guides/dora-metrics/

### Repository evidence reviewed

- `README.md`
- `docs/CURRENT_STATUS.md`
- `docs/01_BENCHMARK_ANALYSIS.md`
- `docs/04_ROADMAP.md`
- `package.json`
- `.github/workflows/ci.yml`
- `.lighthouserc.json`
- `src/app/globals.css`
- `src/lib/motion.tsx`
- `src/components/shell/app-shell.tsx`
- `src/components/shell/sidebar.tsx`
- `src/components/shell/command-bar.tsx`
- `src/components/views/dashboard-view.tsx`
- `src/components/views/compose-view.tsx`
- `tests/e2e/critical-flows.spec.ts`
- Current open issues and recent merged PRs through 2026-07-03

---

## 26. Final product thesis

Nashrino can become a world-class product without matching every enterprise feature of Hootsuite or Sprout. It must instead win decisively on four dimensions:

1. **Trust:** the most truthful and resilient publishing experience in its target market.
2. **Flow:** a faster path from idea to approved, channel-correct, confirmed content.
3. **Persian depth:** RTL, Jalali, local channels, language quality, and local commerce that competitors cannot bolt on convincingly.
4. **Operational intelligence:** one system where teams know what needs attention, what worked, what failed, and what to do next.

The repository is already much more than a skeleton. The 10/10 program is to remove the remaining prototype signals, finish the open quality and feature loops, validate the product with real users and providers, and make every claim provable at the exact release SHA.

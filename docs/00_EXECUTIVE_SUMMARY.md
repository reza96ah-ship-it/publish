# 00 — Executive Summary

## 1. The problem

Persian-speaking commerce and content teams operate in a digital environment that no
world-class social management tool was built for:

1. **The dominant platforms are local or semi-local.** Rubika (~40M users) and Eitaa
   (~30M) are Iranian super-apps with their own Bot APIs. Telegram is the de-facto
   business messaging layer. Instagram is the single most popular social platform in
   Iran (~68% smartphone penetration). LinkedIn serves the B2B segment. **None** of
   Buffer, Hootsuite, Sprout, Later, Publer, ContentStudio, SocialPilot, Metricool, or
   Sendible can publish to Rubika or Eitaa.
2. **The interface language is wrong.** Every major tool is LTR-first and English-first.
   The few that offer Persian locales (e.g., Hootsuite) ship broken RTL layouts, mixed
   LTR punctuation, and no Jalali date support — making the calendar, scheduler, and
   analytics practically unusable for a Persian team.
3. **The calendar is wrong.** Western tools assume the Gregorian calendar. Persian
   teams plan around Nowruz, Yalda, Ramadan, and the working week Saturday–Wednesday.
   A scheduler that cannot render Jalali months is a scheduler a Persian team will not
   use.
4. **The economics are wrong.** Hootsuite starts at $99/user/month and Sprout at
   $249/user/month — denominated in a currency Persian SMBs cannot easily pay, priced
   for a market they are not in. The Iranian Rial equivalent puts these tools out of
   reach for the exact businesses that need them most: local online shops, cafes,
   clinics, course creators, and agencies.
5. **The automation gap.** Persian sellers run high-volume "comment-to-DM" funnels on
   Instagram (e.g., "comment 'کد' to get the price list"). Today this is done with
   fragile foreign tools (ManyChat) that lack Persian-language NLU and operate under
   Meta's 24-hour window — with no native Persian alternative.

## 2. The product

**Nashrino (نشرینو) SocialOps Studio** is the social operations platform purpose-built
for this environment. It is a multi-tenant web application that lets a team:

- **Plan** content on a Jalali calendar with campaign portfolios and readiness tracking.
- **Compose** once and adapt per-channel, with a Persian-first media editor and AI
  caption assistant.
- **Schedule & publish** to Rubika, Instagram, Telegram, and LinkedIn through a
  resilient worker queue with retries, rate-limit handling, and audit trails.
- **Engage** a unified inbox of comments, DMs, and mentions — with compliant
  comment-to-DM automation for Instagram professional accounts.
- **Analyze** performance with a Persian-first analytics layer and exportable reports.
- **Collaborate** with roles, approvals, and an action center that surfaces what needs
  human attention now.

### 2.1 Why now

- **Rubika and Eitaa have matured** their Bot APIs to the point where reliable
  programmatic publishing is feasible.
- **Meta's Instagram Graph API** now supports photo, carousel, Reels, and Stories
  publishing plus the Messaging API for compliant comment-to-DM — the technical
  building blocks exist.
- **The Iranian creator-economy and D2C commerce** sectors have grown sharply, creating
  a paying customer base of teams that need ops tooling, not just scheduling.
- **No incumbent** has invested in RTL + Jalali + local-platform integration, leaving a
  wide, defensible moat.

## 3. Target customers

| Segment                               | Profile                                          | Primary need                                 | Willingness to pay                 |
| ------------------------------------- | ------------------------------------------------ | -------------------------------------------- | ---------------------------------- |
| **SMB online shops**                  | Instagram + Rubika sellers, 1–3 person teams     | Schedule, comment-to-DM, basic analytics     | Low–medium (IRR pricing essential) |
| **Content creators & course sellers** | 1-person brands on IG + Telegram                 | Plan, repurpose, engage audience             | Low                                |
| **Agencies**                          | 3–15 person teams managing 10–50 client accounts | Multi-brand workspaces, approvals, reporting | Medium–high                        |
| **Enterprise / brands**               | 15+ person marketing teams                       | Governance, analytics, SSO, audit            | High                               |
| **News & media**                      | Newsrooms publishing to Telegram/Rubika/IG       | High-volume scheduling, queue health         | Medium–high                        |

**Primary beachhead**: Iranian SMB online shops and small agencies (segments 1 & 3).

## 4. Product scope (current vision)

The platform is organized around **10 primary navigational areas** (see
[README §3](./README.md#3-navigation-model-canonical-10-primary-items)):

1. **Dashboard** — live operational summary, publishing pulse, action center, executive
   metrics, campaign health, platform status.
2. **Compose** — multi-step studio: content → media → platforms → schedule, with
   per-channel adaptation and live preview.
3. **Calendar (Jalali)** — visual month/week/day grid with drag-to-reschedule, queue
   sub-tab, readiness indicators.
4. **Campaigns** — portfolio overview, per-campaign command center (overview, calendar,
   posts, media, report) with health labels and blockers.
5. **Content library** — reusable content items, status lifecycle, search & filter.
6. **Media library** — folders, tags, Persian-first image editor (crop, text overlay in
   Vazirmatn, filters), media reuse.
7. **Inbox** — unified comments + DMs + mentions across channels, reply, automation
   events log, response-time SLA tracking.
8. **Analytics** — reach, engagement, audience growth, conversions, per-campaign and
   per-platform, exportable reports; logs sub-tab.
9. **Channels** — connection hub: OAuth (Instagram, LinkedIn), bot tokens (Rubika,
   Telegram), health checks, token expiry warnings.
10. **Settings (Store profile)** — workspace/brand kit: logo, avatar, brand colors,
    brand voice, default CTA, content guidelines, default hashtags, caption footer,
    timezone, team members & roles.

### 4.1 Channels supported (launch + roadmap)

| Channel                                | Launch      | API                                | Publishing mode                                                                                                        |
| -------------------------------------- | ----------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Instagram**                          | ✅ Phase 1  | Graph API v25+                     | Professional accounts: full API publishing (photo, carousel, Reels, Stories). Personal accounts: reminder/manual mode. |
| **Rubika**                             | ✅ Phase 1  | Bot API v3 (`botapi.rubika.ir/v3`) | Bot publishing to channels/chats.                                                                                      |
| **Telegram**                           | ✅ Phase 2  | Bot API                            | Bot publishing to channels.                                                                                            |
| **LinkedIn**                           | ✅ Phase 2  | Marketing API / Share API          | Text + image + article shares.                                                                                         |
| **Eitaa**                              | 🔜 Phase 3  | Bot API                            | Bot publishing.                                                                                                        |
| **Twitter/X, Threads, YouTube Shorts** | 🔜 Phase 4+ | Native APIs                        | As market demands.                                                                                                     |

### 4.2 Instagram comment-to-DM automation (flagship feature)

A compliant, Persian-tuned automation engine for Instagram professional accounts:

- Trigger on comment keyword/regex (e.g., `کد`, `قیمت`, `link`).
- Send a DM within Meta's **24-hour standard window** (or up to 7 days via the
  `HUMAN_AGENT` message tag for legitimate support follow-up).
- Persian-language keyword matching with digit normalization (Persian/Arabic-Indic digits).
- Per-post automation rules, opt-out, and a full event log in the Inbox.
- **Personal accounts = reminder/manual mode only** (no Messaging API access).

See the dedicated spec referenced in [02_RFP.md §11](./02_RFP.md).

## 5. Competitive positioning (summary)

Nashrino is **not** a clone of any single Western tool. It is a **Persian-first
re-imagining** of the social ops category. Detailed benchmarking is in
[01_BENCHMARK_ANALYSIS.md](./01_BENCHMARK_ANALYSIS.md); the headline positioning:

| Dimension                         | Buffer / Hootsuite / Sprout / Later        | Nashrino                                                                   |
| --------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| RTL / Persian UI                  | Broken or absent                           | Native, first-class                                                        |
| Jalali calendar                   | Absent                                     | Native (months, weekdays, holidays, Sat–Wed work week)                     |
| Rubika / Eitaa                    | Not supported                              | Native Bot API integration                                                 |
| Telegram scheduling               | Limited / via 3rd-party                    | Native                                                                     |
| Persian AI captioning             | Generic English AI                         | Persian-tuned, brand-voice aware                                           |
| Comment-to-DM for Persian sellers | ManyChat (foreign, English-first, fragile) | Native, Persian NLU, compliant                                             |
| Pricing currency                  | USD, expensive for Iran                    | IRR, 10–20× cheaper for the same seat                                      |
| Connectivity reality              | Assumes open internet                      | Resilient to Iranian network conditions (retries, proxy-aware media fetch) |

## 6. Success metrics (North Star & guardrails)

| Metric                             | Definition                                               | Target (12 months post-launch)               |
| ---------------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| **Weekly Active Workspaces (WAW)** | Workspaces with ≥1 successful publish in the last 7 days | 2,000                                        |
| **Publish success rate**           | `successful / (successful + failed)` per attempt         | ≥ 98%                                        |
| **Median time-to-publish**         | From "schedule" click to live post, scheduled-on-time    | ≤ 30s past scheduled time, P95 ≤ 2 min       |
| **Inbox first-response time**      | Median time from inbound message to first reply          | ≤ 15 min (agency tier)                       |
| **Comment-to-DM fulfillment rate** | DMs successfully sent / triggered (within policy)        | ≥ 95%                                        |
| **Net Promoter Score**             | Standard NPS survey at 30/60/90 days                     | ≥ 40                                         |
| **Monthly recurring revenue**      | Paid subscriptions (IRR equivalent tracked)              | Break-even on infrastructure cost by month 9 |

**Guardrails (do not regress):**

- Publish success rate never below 95% in any rolling 24h window.
- P99 page load ≤ 3s on a 4G mobile connection inside Iran.
- Zero data-loss events on the publishing queue (idempotent + durable).

## 7. Team & operating model (assumed for planning)

A lean product team to execute the roadmap in [04](./04_ROADMAP.md):

| Role                                    | Count      | Responsibility                        |
| --------------------------------------- | ---------- | ------------------------------------- |
| Product Manager                         | 1          | Roadmap, specs, prioritization        |
| Engineering Lead / Architect            | 1          | System design, code quality, infra    |
| Full-stack Engineer (Next.js + FastAPI) | 2          | Feature delivery                      |
| Frontend Engineer (RTL/design-system)   | 1          | Design system, accessibility, RTL     |
| Backend/Worker Engineer                 | 1          | Queue, workers, integrations          |
| Designer                                | 1          | UX, design system, Persian typography |
| QA / E2E                                | 1 (shared) | Playwright E2E, regression            |

**Total: ~7 people** for the launch phases. Phases 1–2 (MVP) can be delivered by a
4-person core team with the PM and lead also contributing code.

## 8. Risks & mitigations (top 5)

| #   | Risk                                                               | Likelihood | Impact | Mitigation                                                                                                                         |
| --- | ------------------------------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Meta policy change restricts Instagram publishing or Messaging API | Medium     | High   | Maintain personal-account reminder mode as fallback; diversify to Rubika/Telegram-first workflows; stay compliant with 24h window. |
| 2   | Rubika/Eitaa API instability or breaking changes                   | Medium     | High   | Adapter pattern + health checks + retry/backoff; degrade gracefully to manual.                                                     |
| 3   | Iranian network instability causes media fetch / OAuth failures    | High       | Medium | Resilient media fetch with retry + proxy fallback; idempotent publish; local media caching.                                        |
| 4   | Payment / sanctions constraints on infrastructure (cloud, domains) | Medium     | High   | Host on Iran-resilient infra; multi-provider; IRR billing via local gateways (Zarinpal, etc.).                                     |
| 5   | RTL/Jalali quality regression under fast feature delivery          | Medium     | Medium | Design-system enforcement; RTL + Jalali E2E tests in CI; token audit gate.                                                         |

## 9. What "done" looks like for this document set

This folder is complete when a vendor or new engineer can:

1. Understand **what** to build (RFP, Backlog, Roadmap).
2. Understand **how** to build it (Technical Architecture, Design System).
3. Understand **why** it is built this way (Executive Summary, Benchmark Analysis).
4. Begin work on **day one** without ambiguity about scope, quality bar, or sequence.

Each subsequent document is self-contained but cross-references the others. Start
linearly if you are new; jump directly if you have a specific question.

# Nashrino (نشرینو) SocialOps Studio — Master Documentation Index

> **Single source of truth** for the product, engineering, and operations of Nashrino —
> a Persian-first, RTL-native, Jalali-native multi-channel social operations platform.

This folder is the canonical product plan. Every phase, every epic, every architectural
decision, and every design token referenced in code traces back to a document here.

---

## 0. How to read this folder

| #   | Document                                                 | Audience                   | Purpose                                                           |
| --- | -------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| 00  | [Executive Summary](./00_EXECUTIVE_SUMMARY.md)           | Everyone                   | Vision, problem, market, product scope, success metrics           |
| 01  | [Benchmark Analysis](./01_BENCHMARK_ANALYSIS.md)         | Product, Leadership        | Deep-dive on 16 world-class competitors + best-practice synthesis |
| 02  | [Request for Proposal (RFP)](./02_RFP.md)                | Vendors, Engineering leads | Full statement of work, scope, requirements, evaluation criteria  |
| 03  | [Product Backlog](./03_PRODUCT_BACKLOG.md)               | Product, Engineering       | Epics → user stories → acceptance criteria, sized & prioritized   |
| 04  | [Roadmap](./04_ROADMAP.md)                               | Everyone                   | Phased release plan, milestones, exit criteria                    |
| 05  | [Technical Architecture](./05_TECHNICAL_ARCHITECTURE.md) | Engineering                | System design, data model, APIs, infra, security                  |
| 06  | [Design System](./06_DESIGN_SYSTEM.md)                   | Design, Frontend           | Tokens, components, RTL/Jalali patterns, accessibility            |

---

## 1. One-paragraph product pitch

**Nashrino (نشرینو)** is the social operations studio built for Persian commerce and
content teams. It unifies planning, composing, scheduling, publishing, community
management, and analytics across **Rubika, Instagram, Telegram, LinkedIn** and future
channels — in a fully **RTL, Persian-first, Jalali-native** interface inspired by the
workflow maturity of Buffer, Hootsuite, Sprout Social, and Later, but tuned to the
realities of the Iranian market where the dominant platforms (Rubika, Eitaa, Telegram,
Instagram) are either local or accessed under connectivity constraints that Western
tools were never designed for.

---

## 2. Current repository state (as of this writing)

- **Frontend workspace** (`src/`): Next.js 16 + Tailwind 4 + shadcn/ui, single-route
  app (`/`) with client-side view switching via Zustand, 11 views implemented against
  fixture data, dark/light themes, Vazirmatn font, full RTL. This is the **prototype
  shell** used to validate the UX direction.
- **Backend reference** (`rubika-publisher-mvp-phase4b-publishing-worker`): FastAPI +
  SQLAlchemy + Alembic + Redis + Celery on PostgreSQL 16, Docker Compose on WSL2. Three
  Alembic migrations define the real production schema (`users`, `stores`,
  `rubika_accounts`, `posts`, `media_assets`, `publish_attempts`).
- **Gap to close**: the prototype frontend talks to fixtures, not the FastAPI backend.
  The roadmap in [04](./04_ROADMAP.md) is the bridge from prototype → production.

---

## 3. Navigation model (canonical, 10 primary items)

| #   | Persian label | Route        | View key    |
| --- | ------------- | ------------ | ----------- |
| 1   | داشبورد       | `/`          | `dashboard` |
| 2   | ساخت          | `/compose`   | `compose`   |
| 3   | برنامه‌ریزی   | `/calendar`  | `calendar`  |
| 4   | کمپین‌ها      | `/campaigns` | `campaigns` |
| 5   | محتوا         | `/content`   | `content`   |
| 6   | رسانه         | `/media`     | `media`     |
| 7   | پیام‌ها       | `/inbox`     | `inbox`     |
| 8   | گزارش‌ها      | `/analytics` | `analytics` |
| 9   | کانال‌ها      | `/channels`  | `channels`  |
| 10  | تنظیمات       | `/store`     | `settings`  |

Secondary operational views (`/queue`, `/logs`) are reachable as sub-tabs inside
`/calendar` and `/analytics` respectively — they are **not** permanent primary nav.

---

## 4. Quick navigation

- **Writing an RFP response?** Start at [02_RFP.md](./02_RFP.md).
- **Picking the next sprint?** Read [03_PRODUCT_BACKLOG.md](./03_PRODUCT_BACKLOG.md).
- **Planning a release?** Read [04_ROADMAP.md](./04_ROADMAP.md).
- **Designing a screen?** Read [06_DESIGN_SYSTEM.md](./06_DESIGN_SYSTEM.md) first.
- **Building an API or model?** Read [05_TECHNICAL_ARCHITECTURE.md](./05_TECHNICAL_ARCHITECTURE.md).
- **Need competitive context?** Read [01_BENCHMARK_ANALYSIS.md](./01_BENCHMARK_ANALYSIS.md).

---

## 5. Document conventions

- **Language**: Documents are written in English for vendor/engineering readability.
  All user-facing copy, labels, and UI strings remain **Persian (Farsi)** and are quoted
  in Persian where they appear.
- **Currency**: USD used for competitor benchmarks; IRR (Iranian Rial) used for Nashrino
  pricing targets.
- **Calendar**: All dates in product specs use the **Jalali (Solar Hijri)** calendar
  with Gregorian equivalents in parentheses where helpful.
- **Status tags**: `[SHIPPED]`, `[IN-PROGRESS]`, `[PLANNED]`, `[AT-RISK]`, `[RESEARCH]`.
- **Sizing**: Story points use a modified Fibonacci scale (1, 2, 3, 5, 8, 13, 21).

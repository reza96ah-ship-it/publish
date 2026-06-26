# Nashrino — نشرینو

> Persian-first, RTL-native, Jalali-native social-media management platform.
> Schedule, publish, and analyze content across Telegram, Bale, Rubika, Instagram, and LinkedIn.

[![CI](https://github.com/reza96ah-ship-it/publish/actions/workflows/ci.yml/badge.svg)](https://github.com/reza96ah-ship-it/publish/actions/workflows/ci.yml)
[![Production readiness](https://img.shields.io/badge/production--readiness-2%2F10-red)](docs/PRODUCTION_READINESS_MASTER_PLAN.md)

---

## Quick start

### Prerequisites

- [Node.js 24 LTS](https://nodejs.org/) (or [Bun](https://bun.sh/) 1.2+ for dev)
- [PostgreSQL 18](https://www.postgresql.org/) (production) — SQLite works for dev
- [Redis 7](https://redis.io/) (for workers, rate limiting, realtime adapter)

### Install + run (dev)

```bash
git clone https://github.com/reza96ah-ship-it/publish.git
cd publish
bun install
cp .env.example .env
# Edit .env — set DATABASE_URL, NEXTAUTH_SECRET, etc.
bunx prisma generate
bunx prisma db push
bun run seed:auth    # creates demo user demo@nashrino.ir / demo1234
bun run dev          # http://localhost:3000
```

### Run the mini-services

```bash
# Realtime (socket.io) — port 3003
cd mini-services/realtime && bun run dev

# Publish worker — polls for pending jobs
cd mini-services/publish-worker && bun run dev
```

### Test

```bash
bun run test          # Vitest unit tests (11 tests)
bun run test:e2e      # Playwright E2E (requires running dev server)
bun run lint          # ESLint
bun run typecheck     # tsc --noEmit
```

---

## Tech stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 24 LTS (prod), Bun 1.2 (dev) |
| **Framework** | Next.js 16 (App Router, RSC, standalone output) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS 4 + shadcn/ui (New York) |
| **Database** | PostgreSQL 18 (prod), SQLite (dev) |
| **ORM** | Prisma |
| **Auth** | NextAuth.js v4 (Credentials provider, JWT sessions) |
| **Realtime** | socket.io + Redis adapter |
| **Queue** | BullMQ (planned) — currently DB-polling |
| **AI** | GapGPT (gpt-5-mini) → Google Gemini → z-ai fallback chain |
| **Editor** | Tiptap v3 |
| **Charts** | Recharts |
| **Motion** | Framer Motion |
| **Calendar** | Jalali (Solar Hijri) — bespoke `src/lib/jalali.ts` |

See [`docs/VERSION_BASELINE_2026.md`](docs/VERSION_BASELINE_2026.md) for full version pins.

---

## Project structure

```
publish/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # 36 API route handlers (BFF layer)
│   │   ├── layout.tsx          # Root layout (RSC, providers)
│   │   └── page.tsx            # Root page (RSC → AppRouter client island)
│   ├── components/
│   │   ├── views/              # 9 page-level views (dashboard, compose, calendar, …)
│   │   ├── shell/              # App shell, sidebar, command palette, AppRouter
│   │   ├── dashboard/          # Dashboard panels
│   │   ├── editor/             # Tiptap editor, media uploader, preview
│   │   ├── ai/                 # AI assistant sheet, caption assistant
│   │   └── ui/                 # 50 shadcn/ui primitives
│   ├── lib/                    # auth, db, validations, jalali, ai, store, …
│   ├── hooks/                  # use-publish-stream, use-toast, …
│   └── types/                  # next-auth.d.ts
├── prisma/
│   ├── schema.prisma           # 17 models
│   ├── seed.ts                 # Demo data
│   └── seed-auth.ts            # Demo user
├── mini-services/
│   ├── publish-worker/         # Bun worker (5 adapters: TG, Bale, Rubika, IG, LinkedIn)
│   └── realtime/               # socket.io service
├── tests/
│   ├── unit/                   # Vitest (jalali, validations)
│   └── e2e/                    # Playwright (smoke tests)
├── docs/                       # Architecture, roadmap, decisions
└── audit/                      # Production-readiness audit
```

See [`docs/ARCHITECTURE_MODULAR_MONOLITH.md`](docs/ARCHITECTURE_MODULAR_MONOLITH.md) for the target architecture (11 domain modules).

---

## Production readiness

**Current status: 2/10 — NOT production-ready.**

5 blocking security issues must be fixed before any external exposure. See:

- 📊 [**Audit report**](audit/AUDIT-PRODUCTION-READINESS.md) — 896 lines, evidence-based, file:line citations
- 🗺️ [**Master plan**](docs/PRODUCTION_READINESS_MASTER_PLAN.md) — 10-phase roadmap to 9/10
- 📋 [**Current status**](docs/CURRENT_STATUS.md) — scorecard + blockers
- 🗓️ [**Roadmap**](docs/IMPLEMENTATION_ROADMAP.md) — 10 phases with acceptance criteria
- 🏗️ [**Architecture**](docs/ARCHITECTURE_MODULAR_MONOLITH.md) — modular monolith, BFF, 11 domain modules
- 🔖 [**Version baseline**](docs/VERSION_BASELINE_2026.md) — stable pins (no experimental)
- 📝 [**Decision log**](docs/DECISION_LOG.md) — 15 architecture decisions

### 10-phase roadmap

| Phase | Focus | Effort | Issues |
|---|---|---|---|
| **1** | P0 Safety Blockers | 1 week | [#2-#11](https://github.com/reza96ah-ship-it/publish/milestone/1) |
| **2** | Observability + Health | 3 days | [milestone #2](https://github.com/reza96ah-ship-it/publish/milestone/2) |
| **3** | Docker + CI/CD | 4 days | [milestone #3](https://github.com/reza96ah-ship-it/publish/milestone/3) |
| **4** | PostgreSQL Migration | 4 days | [milestone #4](https://github.com/reza96ah-ship-it/publish/milestone/4) |
| **5** | Token Encryption + RBAC | 3 days | [milestone #5](https://github.com/reza96ah-ship-it/publish/milestone/5) |
| **6** | Worker Hardening | 4 days | [milestone #6](https://github.com/reza96ah-ship-it/publish/milestone/6) |
| **7** | Realtime Auth + Redis | 3 days | [milestone #7](https://github.com/reza96ah-ship-it/publish/milestone/7) |
| **8** | API Quality | 4 days | [milestone #8](https://github.com/reza96ah-ship-it/publish/milestone/8) |
| **9** | Media: S3 + Validation | 4 days | [milestone #9](https://github.com/reza96ah-ship-it/publish/milestone/9) |
| **10** | Testing + Performance | 5 days | [milestone #10](https://github.com/reza96ah-ship-it/publish/milestone/10) |

---

## Environment variables

See [`.env.example`](.env.example) for the full list. Key ones:

| Var | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (prod) or SQLite path (dev) |
| `NEXTAUTH_SECRET` | ✅ | JWT signing secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | ✅ | App base URL |
| `GAPGPT_API_KEY` | Optional | Primary AI provider |
| `GEMINI_API_KEY` | Optional | Fallback AI provider |
| `REDIS_URL` | Phase 6+ | Redis for BullMQ, rate limiting, socket.io adapter |

---

## Supported platforms

| Platform | Status | API |
|---|---|---|
| **Telegram** | ✅ Real | Bot API (`sendMessage`) |
| **Bale** | ✅ Real | Bot API (Telegram-compatible) |
| **Rubika** | ✅ Real | Bot API (`sendMessage`) |
| **Instagram** | ✅ Real | Meta Graph API (container publish) |
| **LinkedIn** | ✅ Real | Posts API (UGC posts) |

**No scraping, no password login automation, no unofficial DM.** Instagram personal accounts use manual/reminder mode.

---

## Contributing

1. Pick an issue from the current [milestone](https://github.com/reza96ah-ship-it/publish/milestones).
2. Create a branch: `fix/phase-{N}-{slug}` or `feat/{slug}`.
3. Make changes. Keep PRs small (one concern each).
4. Ensure CI passes: `bun run lint && bun run typecheck && bun run test && bun run build`.
5. Open a PR referencing the issue.

See [`docs/PRODUCTION_READINESS_MASTER_PLAN.md`](docs/PRODUCTION_READINESS_MASTER_PLAN.md) §12 for the Definition of Done.

---

## License

Proprietary. © Nashrino.

# Nashrino — نشرینو

> Persian-first, RTL-native, Jalali-native social-media management platform.
> Schedule, publish, and analyze content across Telegram, Bale, Rubika, Instagram, and LinkedIn.

[![CI](https://github.com/reza96ah-ship-it/publish/actions/workflows/ci.yml/badge.svg)](https://github.com/reza96ah-ship-it/publish/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-500%2B-green)](tests/)

---

## Current status

**Architecture:** Modular monolith on Next.js 16 + PostgreSQL + Prisma 7 + BullMQ + Redis
**Auth:** NextAuth v4 + Argon2id + MFA TOTP + RBAC with 19 permissions
**Providers:** Telegram (certified), Instagram (beta), LinkedIn (beta), Bale/Rubika/Eitaa (experimental)
**Test count:** 500+ (unit + contract + integration + E2E)
**Gate status:** Gates 1-8 in progress — see [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md)

## Quick start

### Prerequisites

- [Bun](https://bun.sh/) 1.2+
- [PostgreSQL 16+](https://www.postgresql.org/) (production) or SQLite (dev preview)
- [Redis 7](https://redis.io/) (for BullMQ queue, rate limiting, realtime adapter)
- [Docker](https://www.docker.com/) (for full stack via docker-compose)

### Install + run (dev)

```bash
git clone https://github.com/reza96ah-ship-it/publish.git
cd publish
bun install
cp .env.example .env
# Edit .env — set DATABASE_URL, NEXTAUTH_SECRET, etc.
DATABASE_URL=postgresql://nashrino:password@localhost:5432/nashrino?schema=public bunx prisma generate
bunx prisma migrate deploy
bun run seed:auth    # creates demo user demo@nashrino.ir / demo1234
bun run dev          # http://localhost:3000
```

### Full stack with Docker

```bash
docker compose up -d    # PostgreSQL, PgBouncer, Redis (queue + cache), app, worker, realtime
```

### Test

```bash
bun run test              # unit + contract tests
bun run test:integration  # PostgreSQL + Redis integration tests (requires services)
bun run test:e2e          # Playwright E2E (Chromium, Firefox, WebKit, mobile)
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Next.js 16 │────▶│  PostgreSQL  │     │  Redis      │
│  (App Router)│    │  + PgBouncer │     │  (queue +   │
│  + Tailwind  │    │  + Prisma 7  │     │   cache)    │
│  + shadcn/ui │    └──────────────┘     └──────┬──────┘
└──────┬──────┘                                 │
       │ Outbox events                          │ BullMQ
       ▼                                        ▼
┌──────────────┐     ┌──────────────────────────────┐
│  Worker      │────▶│  Provider Adapters            │
│  (BullMQ)    │    │  Telegram, Instagram,         │
│  + Outbox    │    │  LinkedIn, Bale, Rubika, Eitaa │
│  dispatcher  │    └──────────────────────────────┘
└──────┬───────┘
       │ HTTP POST /emit
       ▼
┌──────────────┐
│  Realtime    │────▶  Browser (Socket.io)
│  (Socket.io) │
└──────────────┘
```

## Key features

- **Transactional outbox** — publications survive Redis/worker crashes
- **Attempt ledger** — prevents duplicate external posts (stable fingerprints)
- **RBAC** — 19 permissions across admin/editor/approver/viewer roles
- **Secure invitations** — hashed tokens, 7-day expiry, last-admin protection
- **Provider auth** — real OAuth for Instagram/LinkedIn, bot-token validation for Telegram/Bale/Rubika
- **MFA** — TOTP for admin accounts with backup codes
- **Key rotation** — AES-256-GCM with versioned keys
- **CSP nonce** — per-request nonce, no unsafe-inline
- **Distributed tracing** — W3C Trace Context through the entire pipeline
- **SLOs** — 9 SLOs with error budgets and burn-rate alerts

## Documentation

- [Current Status](docs/CURRENT_STATUS.md) — gate progress + scorecard
- [Architecture Rules](docs/ARCHITECTURE_RULES.md) — module boundaries + dependencies
- [Authorization Matrix](docs/security/AUTHORIZATION_MATRIX.md) — RBAC + route inventory
- [Release Gate Checklist](docs/testing/RELEASE_GATE_CHECKLIST.md) — 8-tier test pyramid
- [Alert Rules](docs/operations/ALERT_RULES.md) — 14 alerts with runbooks
- [Runbooks](docs/operations/runbooks/README.md) — 12 incident response runbooks
- [Capacity Sizing](docs/operations/CAPACITY_SIZING.md) — deployment sizing guide
- [Dashboards](docs/operations/DASHBOARDS.md) — 10 dashboard definitions

## License

Proprietary. See repository settings for details.

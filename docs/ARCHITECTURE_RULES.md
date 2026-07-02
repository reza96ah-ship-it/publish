# Architecture Rules — Issue #156

## 1. Dependency Direction Rules

```
┌─────────────────────────────────────────────────────────────┐
│                    Route Handlers (transport)                │
│  src/app/api/**/route.ts — auth, validate, call service, map │
└──────────────────────────┬──────────────────────────────────┘
                           │ depends on
┌──────────────────────────▼──────────────────────────────────┐
│                   Application Services                       │
│  src/modules/*/service.ts — business logic, orchestration    │
│  src/modules/*/errors.ts — domain errors                     │
│  src/modules/*/types.ts — domain types                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ depends on
┌──────────────────────────▼──────────────────────────────────┐
│                    Repositories                              │
│  src/modules/*/repository.ts — Prisma queries, transactions  │
└──────────────────────────┬──────────────────────────────────┘
                           │ depends on
┌──────────────────────────▼──────────────────────────────────┐
│              Infrastructure (Prisma, Redis, Crypto)           │
│  src/lib/db.ts, src/lib/crypto.ts, src/lib/queue.ts          │
└─────────────────────────────────────────────────────────────┘
```

**Rules:**
- Route handlers → Services only (never Repositories directly)
- Services → Repositories (never Prisma directly)
- Repositories → Prisma (never Services or Routes)
- Domain modules → do NOT import `next/server`, `next/navigation`, or UI components
- Cross-module communication → via service interfaces, not deep imports

## 2. Module Map

| Module | Path | Owner | Status |
|--------|------|-------|--------|
| publications | `src/modules/publications/` | Backend | ✅ migrated |
| identity/auth | `src/lib/auth.ts`, `auth-guards.ts` | Backend | ⚠️ needs extraction |
| workspaces/members | `src/modules/membership/` | Backend | ✅ migrated |
| content/revisions | `src/modules/content/` | Backend | ✅ migrated |
| channels/credentials | `src/modules/channels/` | Backend | ✅ migrated |
| media | `src/modules/media/` | Backend | ✅ migrated |
| campaigns | `src/app/api/campaigns/` | Backend | ⚠️ needs extraction |
| inbox | `src/modules/inbox/` | Backend | ✅ migrated |
| notifications | `src/modules/notifications/` | Backend | ✅ migrated |
| analytics | `src/modules/analytics/` | Backend | ✅ migrated |
| operations/health | `src/app/api/health/`, `readyz/` | Backend | ⚠️ needs extraction |

## 3. Shared Contracts (Issue #156)

- `src/lib/api-contracts.ts` — normalized error envelope, pagination, domain enums
- `src/lib/provider-capabilities.ts` — single source of truth for provider capabilities
- `src/lib/validations.ts` — Zod schemas (generate TS types from these)

## 4. Type Safety Policy

- `any` is banned in production-critical code (≤2 per file for Prisma JSON casts)
- Use `unknown` + Zod validation for provider/client JSON
- Use exhaustive switches with `assertExhaustive()` for all enum handling
- TypeScript strict mode + `noImplicitAny` + `noUncheckedIndexedAccess` enforced

## 5. Architecture Enforcement

- `tests/unit/architecture/boundary-tests.test.ts` runs in CI
- Tests verify: no Next.js imports in domain modules, no UI imports in domain modules,
  provider capabilities in sync, `any` count within limits, route handler line counts

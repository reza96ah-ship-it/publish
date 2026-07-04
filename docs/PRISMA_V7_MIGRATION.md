# Prisma v7 Migration Plan

**Status:** Pre-migration (documentation only — do NOT migrate before GA launch)
**Target:** Prisma 7.x (post-launch sprint)
**Blocker:** Next.js 16 + Turbopack compatibility (https://github.com/prisma/prisma/issues/28950)

## Why not migrate now

Prisma 6 → 7 is a major upgrade with breaking changes:

- `PrismaClient` now requires a driver adapter (no bare `new PrismaClient()`)
- Connection URL moves from `schema.prisma` to `prisma.config.ts`
- Seeding behavior changes (explicit `prisma db seed` required)
- Client output path changes (`generated/prisma/client`)
- `--skip-generate` and `--skip-seed` flags removed

## Files that use Prisma (must update during migration)

### App (src/)

- `src/lib/db.ts` — `new PrismaClient()` → adapter pattern
- `src/lib/auth.ts` — `db.user.findUnique` in `authorize()`
- `src/lib/auth-guards.ts` — `db.workspaceMember.findFirst` in `requireWorkspaceApi()`
- `src/lib/audit.ts` — `db.auditLog.create()`
- `src/lib/server.ts` — `db.workspace.findFirst/findUnique`
- All 36 API routes in `src/app/api/` — import `db` from `@/lib/db`

### Worker (mini-services/publish-worker/)

- `mini-services/publish-worker/lib/db.ts` — `new PrismaClient()` → adapter pattern
- `mini-services/publish-worker/index.ts` — all DB queries
- `mini-services/publish-worker/prisma/schema.prisma` — duplicate schema (delete after migration)

### Seed scripts

- `prisma/seed.ts` — `db.workspace.create()`, `db.platform.create()`, etc.
- `prisma/seed-auth.ts` — `db.user.create()`, `db.workspaceMember.create()`

### Config

- `prisma/schema.prisma` — datasource + generator blocks change
- `package.json` — `prisma` and `@prisma/client` version pins
- `next.config.ts` — `serverExternalPackages` may need update
- `Dockerfile` — client output path changes
- `vitest.config.ts` — alias may need update

## Pre-migration tasks (do NOW)

- [x] Pin `prisma` and `@prisma/client` to `^6.x` in package.json (prevent accidental v7)
- [x] Document all call sites (this file)
- [x] This document created

## Migration tasks (post-launch)

1. Create `prisma.config.ts` with `PrismaPg` adapter
2. Update `src/lib/db.ts`:
   ```ts
   import { PrismaPg } from '@prisma/adapter-pg'
   import { PrismaClient } from '@prisma/client'
   const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
   export const db = new PrismaClient({ adapter })
   ```
3. Update `mini-services/publish-worker/lib/db.ts` (same pattern)
4. Delete `mini-services/publish-worker/prisma/schema.prisma` (use shared schema)
5. Update CI: remove `--skip-generate`, add explicit `prisma db seed`
6. Update Dockerfile for new client output path
7. Run full migration test in staging before prod

## Version pins (current)

```json
"prisma": "^6.x",
"@prisma/client": "^6.x"
```

Do NOT upgrade to `^7.x` until this migration is executed.

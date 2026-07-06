# Auth Architecture & Modernization Plan

**Status:** Pre-migration (documentation only — stay on NextAuth v4 for GA launch)
**Target:** Better Auth (Month 2 post-launch)
**Current:** NextAuth v4.24.x

## Current auth flow

1. User submits email + password at `/auth/signin`
2. NextAuth `Credentials` provider calls `authorize()` in `src/lib/auth.ts`
3. `authorize()` queries `db.user.findUnique` with `memberships` (workspace roles)
4. Password verified via `scrypt` (`src/lib/password.ts`)
5. Account lockout after 5 failed attempts (15-min lock)
6. JWT session returned with `{ id, email, name, role, activeWorkspaceId }`
7. Session stored in HTTP-only cookie (`next-auth.session-token`)
8. Middleware (`src/middleware.ts`) protects all routes except `/api/auth`, `/api/health`, `/auth/signin`
9. API routes use `requireWorkspaceApi()` from `src/lib/auth-guards.ts` (returns 401/403 JSON)

## Dev bypass

In development (`NODE_ENV !== 'production'`):

- Middleware `authorized()` callback returns `true` (no auth check)
- `requireWorkspaceApi()` falls back to first workspace (demo mode)
- `DISABLE_AUTH` env var can force-disable auth in any environment

## Call sites to audit for migration

### `getServerSession()` call sites (11 files)

- `src/lib/auth-guards.ts` — `requireWorkspaceApi()`, `requireAuth()`, `requireWorkspace()`, `requireRole()`
- `src/lib/auth.ts` — `authorize()`, `jwt()` callback, `session()` callback
- `src/lib/server.ts` — `getWorkspace()`, `getUserId()`
- `src/app/api/publish/route.ts` — `getServerSession()` for author name
- `src/app/auth/signin/signin-form.tsx` — client-side CSRF token fetch

### `requireWorkspaceApi()` call sites (31 API routes)

All routes in `src/app/api/` that call `requireWorkspaceApi()`:

- `ai/caption`, `ai/hashtags`, `ai/drafts`, `ai/drafts/[id]`, `ai/caption-multi`
- `analytics`, `analytics/real`
- `calendar`, `campaigns`, `content`, `content/[id]/approve`, `content/[id]/reject`,
  `content/[id]/comments`, `content/[id]/submit-review`
- `dashboard/summary`, `dashboard/pulse`, `dashboard/metrics`, `dashboard/action-center`
- `inbox`, `inbox/[id]/assign`, `inbox/[id]/read`, `inbox/[id]/reply`
- `media`, `media/presign`, `media/confirm`, `media/upload`
- `members`, `members/invite`
- `notifications`, `platforms`, `platforms/[id]/connect`, `platforms/[id]/validate`
- `publish`, `publish-jobs`, `publish-jobs/[id]`
- `workspace`

### `can()` RBAC call sites (5 routes)

- `publish/route.ts` — `content.publish`
- `publish-jobs/[id]/route.ts` — `job.schedule`
- `content/[id]/approve/route.ts` — `content.review`
- `content/[id]/reject/route.ts` — `content.review`
- `members/invite/route.ts` — `member.invite`

## Migration to Better Auth (post-launch)

### Benefits

- Multi-tenant workspace support (built-in organization plugin)
- Passkey / 2FA plugins
- Bun-native compatibility
- Full TypeScript inference
- NextAuth v4 entering maintenance mode

### Migration steps

1. Install `better-auth` + `@better-auth/prisma`
2. Create `src/lib/better-auth.ts` config with Prisma adapter
3. Map NextAuth Credentials provider → Better Auth email/password plugin
4. Map `activeWorkspaceId` → Better Auth organization plugin
5. Migrate JWT payload fields (`id`, `role`, `activeWorkspaceId`) to Better Auth session
6. Replace all `getServerSession()` → Better Auth `auth()` calls
7. Replace `requireWorkspaceApi()` → Better Auth organization guard
8. Remove `next-auth` dependency
9. Update middleware to use Better Auth session check
10. Migrate existing user passwords (scrypt hash format compatible)

### Safety net

- Auth integration tests (#65) act as migration safety net
- All 5 RBAC `can()` tests must pass after migration
- All 31 `requireWorkspaceApi()` routes must return correct 401/403

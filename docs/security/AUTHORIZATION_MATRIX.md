# Authorization Matrix — Issue #142

**Last updated:** 2026-06-28
**Audited SHA:** `db0f7e1`
**Total API routes:** 49 (35 workspace-scoped, 4 public auth, 2 health, 8 other)

## Permission Matrix

| Permission | admin | editor | approver | viewer | Unknown role |
|---|:---:|:---:|:---:|:---:|:---:|
| content.create | ✅ | ✅ | ❌ | ❌ | ❌ (fail closed) |
| content.edit | ✅ | ✅ | ❌ | ❌ | ❌ |
| content.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| content.review | ✅ | ❌ | ✅ | ❌ | ❌ |
| content.publish | ✅ | ✅ | ❌ | ❌ | ❌ |
| job.schedule | ✅ | ✅ | ❌ | ❌ | ❌ |
| job.cancel | ✅ | ✅ | ❌ | ❌ | ❌ |
| platform.manage | ✅ | ✅ | ❌ | ❌ | ❌ |
| platform.connect | ✅ | ❌ | ❌ | ❌ | ❌ |
| inbox.reply | ✅ | ✅ | ❌ | ❌ | ❌ |
| inbox.assign | ✅ | ✅ | ❌ | ❌ | ❌ |
| member.invite | ✅ | ❌ | ❌ | ❌ | ❌ |
| member.remove | ✅ | ❌ | ❌ | ❌ | ❌ |
| billing.manage | ✅ | ❌ | ❌ | ❌ | ❌ |
| security.admin | ✅ | ❌ | ❌ | ❌ | ❌ |
| analytics.view | ✅ | ✅ | ✅ | ❌ | ❌ |
| media.upload | ✅ | ✅ | ❌ | ❌ | ❌ |
| media.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| workspace.settings | ✅ | ❌ | ❌ | ❌ | ❌ |

## Route Authorization Inventory

### Public routes (no auth required)

| Route | Method | Permission | Notes |
|---|---|---|---|
| `/api/auth/[...nextauth]` | ALL | — | NextAuth callback endpoints |
| `/api/health` | GET | — | Liveness probe (orchestrator) |
| `/api/readyz` | GET | — | Readiness probe (orchestrator) |
| `/api/metrics` | GET | — | Prometheus metrics (network-restricted in prod) |
| `/api/vitals` | POST | — | Web Vitals collection (non-blocking) |

### Authenticated routes (session required, no workspace)

| Route | Method | Permission | Notes |
|---|---|---|---|
| `/api/auth/mfa/setup` | POST | — (authenticated) | User manages own MFA |
| `/api/auth/mfa/verify` | POST | — (authenticated) | User verifies own MFA |
| `/api/auth/mfa/disable` | POST | — (authenticated) | User disables own MFA |
| `/api/realtime-token` | GET | — (authenticated) | Issues realtime JWT for own session |

### Workspace-scoped routes (membership + permission required)

| Route | Method | Permission | Guard |
|---|---|---|---|
| `/api/publish` | POST | `content.publish` | `requirePermissionApi` |
| `/api/compose-draft` | POST | `content.create` | `requirePermissionApi` |
| `/api/content` | GET/POST | `content.create` | `requirePermissionApi` |
| `/api/content/[id]/approve` | POST | `content.review` | `requirePermissionApi` |
| `/api/content/[id]/reject` | POST | `content.review` | `requirePermissionApi` |
| `/api/content/[id]/submit-review` | POST | `content.edit` | `requirePermissionApi` |
| `/api/content/[id]/comments` | GET/POST | `content.edit` | `requirePermissionApi` |
| `/api/publish-jobs` | GET | `job.schedule` | `requirePermissionApi` |
| `/api/publish-jobs/[id]` | GET/PATCH/DELETE | `job.schedule` | `requirePermissionApi` |
| `/api/platforms` | GET | `platform.manage` | `requirePermissionApi` |
| `/api/platforms/[id]/connect` | POST | `platform.connect` | `requirePermissionApi` |
| `/api/platforms/[id]/validate` | POST | `platform.manage` | `requirePermissionApi` |
| `/api/channels/health` | GET | `platform.manage` | `requirePermissionApi` |
| `/api/inbox` | GET | `inbox.reply` | `requirePermissionApi` |
| `/api/inbox/[id]/reply` | POST | `inbox.reply` | `requirePermissionApi` |
| `/api/inbox/[id]/read` | POST | `inbox.reply` | `requirePermissionApi` |
| `/api/inbox/[id]/assign` | POST | `inbox.assign` | `requirePermissionApi` |
| `/api/media` | GET | `media.upload` | `requirePermissionApi` |
| `/api/media/presign` | POST | `media.upload` | `requirePermissionApi` |
| `/api/media/upload` | POST | `media.upload` | `requirePermissionApi` |
| `/api/media/confirm` | POST | `media.upload` | `requirePermissionApi` |
| `/api/members` | GET | `security.admin` | `requirePermissionApi` |
| `/api/members` | POST | `member.invite` | `requirePermissionApi` |
| `/api/members/invite` | POST | `member.invite` | `requirePermissionApi` |
| `/api/campaigns` | GET | `analytics.view` | `requirePermissionApi` |
| `/api/campaigns` | POST | `content.create` | `requirePermissionApi` |
| `/api/analytics` | GET | `analytics.view` | `requirePermissionApi` |
| `/api/analytics/real` | GET | `analytics.view` | `requirePermissionApi` |
| `/api/calendar` | GET | `analytics.view` | `requirePermissionApi` |
| `/api/dashboard/summary` | GET | `analytics.view` | `requirePermissionApi` |
| `/api/dashboard/metrics` | GET | `analytics.view` | `requirePermissionApi` |
| `/api/dashboard/pulse` | GET | `analytics.view` | `requirePermissionApi` |
| `/api/dashboard/action-center` | GET | `analytics.view` | `requirePermissionApi` |
| `/api/notifications` | GET | `security.admin` | `requirePermissionApi` |
| `/api/workspace` | GET/PATCH | `workspace.settings` | `requirePermissionApi` |
| `/api/ai/drafts` | GET/POST | `content.create` | `requirePermissionApi` |
| `/api/ai/drafts/[id]` | GET/DELETE | `content.create` | `requirePermissionApi` |

### Worker / realtime endpoints

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| Worker `/health` | GET | — (internal network) | Liveness + queue depth |
| Worker `/board` | GET | Basic auth (password) | Bull Board dashboard |
| Realtime `/health` | GET | — (internal network) | Liveness |
| Realtime `/metrics` | GET | — (internal network) | Prometheus |
| Realtime `/emit` | POST | `X-Emit-Secret` header | Worker → realtime relay |
| Realtime socket connect | — | JWT handshake | Per-connection auth |

## Object-level authorization

Every database query that accesses workspace-scoped resources MUST include
`workspaceId` in the predicate. Resources: Content, PublishJob, Platform,
Campaign, Media, InboxMessage, Notification, AnalyticsSnapshot, ContentDraft.

**Rule:** Never fetch by `id` alone and authorize afterward. Always use:
```ts
db.content.findFirst({ where: { id, workspaceId } })
```
This prevents cross-tenant access and avoids leaking existence via 404 vs 403.

## Changes in this PR (Issue #142)

- Added `requirePermissionApi(permission)` — combines workspace membership + permission check
- Added `requireAnyPermissionApi([...])` — for routes needing any of several permissions
- Added `requirePermission(permission)` — server-component equivalent
- Added 8 new permissions: `platform.connect`, `inbox.assign`, `member.remove`, `security.admin`, `analytics.view`, `media.upload`, `media.delete`, `workspace.settings`
- `can()` now fails closed for unknown roles (returns `false`)
- Migrated all 35 workspace-scoped routes from `requireWorkspaceApi()` to `requirePermissionApi(perm)`
- Removed redundant manual `can()` checks from `publish/route.ts`

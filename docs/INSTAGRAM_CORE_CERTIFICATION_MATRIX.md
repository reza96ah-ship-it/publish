# Instagram Core Certification Matrix — Nashrino

**Last updated:** 2026-07-16
**Authority:** GitHub issue #160 (engineering gates)
**Related issues:** #347 (connection), #349 (publishing), #353 (inbox), #354 (automation), #355 (analytics)

**Status values:**
- `Proven` — works end-to-end, tested automatically, verified on non-tester real account, failure and recovery paths verified, evidence recorded
- `Implemented-unproven` — code exists, unit/local tests may exist, non-tester/production-like evidence incomplete
- `Incomplete` — partial workflow, important states or integrations missing
- `Missing` — required capability does not exist
- `Out-of-scope` — not required for current product boundary

**Row format:**
```
Capability | Status | Code path | API route | Worker | Permission | Webhook | Tests | Non-tester evidence | Known limitation | Issue | SHA | Last verified
```

---

## A. Connection

Code paths (from code audit 2026-07-16):
- OAuth start: `src/app/api/platforms/oauth/start/route.ts` → `src/modules/oauth/service.ts:54`
- OAuth callback: `src/app/api/platforms/oauth/callback/route.ts` → `src/modules/oauth/service.ts:118`
- Auth adapter: `src/lib/provider-auth/oauth-adapters.ts` (InstagramAuthAdapter)
- State cookie: `oauth_state_{state}`, 15-min TTL, httpOnly
- Token storage: `db.platform.tokenSecret` (encrypted), `tokenExpiresAt`, `tokenScopes`
- Audit log: `db.auditLog` action `platform.connected`
- Webhook subscription: `src/modules/oauth/service.ts:226` — `POST /{igUserId}/subscribed_apps?subscribed_fields=comments,messages,mentions`

| Capability | Status | Code path | API route | Permission | Webhook | Tests | Non-tester | Limitation | Issue |
|---|---|---|---|---|---|---|---|---|---|
| OAuth start | Implemented-unproven | `oauth/service.ts:54` | `GET /api/platforms/oauth/start` | `instagram_basic` | — | ❓ | ❓ | — | #347 |
| OAuth callback + token storage | Implemented-unproven | `oauth/service.ts:118` | `GET /api/platforms/oauth/callback` | — | — | ❓ | ❓ | — | #347 |
| CSRF / state validation | Implemented-unproven | `oauth/service.ts:130` | callback | — | — | ❓ | ❓ | — | #347 |
| PKCE S256 | Implemented-unproven | `oauth-adapters.ts:47-57` | auth + token exchange | — | — | ❓ | ❓ | Mandatory, always generated | #347 |
| Account identity verification | Implemented-unproven | `oauth-adapters.ts:99-110` | `GET /me?fields=id,username` | `instagram_basic` | — | ❓ | ❓ | — | #347 |
| Scope verification after token exchange | Implemented-unproven | `oauth-adapters.ts:104-110` | `GET /me/permissions` | — | — | ❓ | ❓ | Returns granted scopes only | #347 |
| Permission grant / denial handling | Implemented-unproven | `oauth/service.ts:123` | callback | All | — | ❓ | ❓ | User denial → error redirect | #347 |
| Token encryption at rest | Implemented-unproven | `oauth-adapters.ts:113` | — | — | — | ❓ | ❓ | Uses `encrypt()` from `lib/crypto` | #160 |
| Long-lived token exchange (60-day) | Implemented-unproven | `oauth-adapters.ts:84-92` | `GET /access_token?grant_type=fb_exchange_token` | — | — | ❓ | ❓ | Fallback: 60-day estimate | #347 |
| Token expiry storage | Implemented-unproven | `oauth/service.ts:170` | — | — | — | ❓ | ❓ | `platform.tokenExpiresAt` | #347 |
| Scope storage | Implemented-unproven | `oauth/service.ts:173` | — | — | — | ❓ | ❓ | `platform.tokenScopes` comma-joined | #347 |
| Health check (`/me` re-validation) | Implemented-unproven | `oauth-adapters.ts:125-190` | `GET /me?fields=id,username` | `instagram_basic` | — | ❓ | ❓ | 401 → expired, else → active | #347 |
| Webhook per-account subscription | Implemented-unproven | `oauth/service.ts:206-256` | `POST /{igUserId}/subscribed_apps` | Advanced Access required | comments,messages,mentions | ❓ | ❓ | Best-effort, swallows errors silently | #347 |
| Reconnect flow (reuse platform row) | Implemented-unproven | `oauth/service.ts:73-85` | start | All | — | ❓ | ❓ | Reuses existing Platform row | #347 |
| Disconnect flow | Implemented-unproven | ❓ | ❓ | — | — | ❓ | ❓ | — | #347 |
| Audit log | Implemented-unproven | `oauth/service.ts:182-198` | — | — | — | ❓ | ❓ | Non-fatal if write fails | #347 |
| Non-tester business account | ❓ Untested | — | — | All (Advanced Access) | All | — | ❓ | **Critical gate** — Advanced Access required for publish/messages/comments | #345 |
| Non-tester creator account | ❓ Untested | — | — | All (Advanced Access) | All | — | ❓ | Advanced Access required | #345 |
| Workspace isolation | Implemented-unproven | `oauth/service.ts:73,143` | start+callback | — | — | ❓ | ❓ | `workspaceId` filter on all queries | #347 |
| Pages_show_list scope behavior | ❓ Untested | — | — | `pages_show_list` | — | — | ❓ | **Flag:** Page permission requested at Instagram Login endpoint — may require linked Facebook Page | #343 |

---

## B. Initial sync

| Capability | Status | Code path | Worker | Tests | Evidence | Limitation | Issue |
|---|---|---|---|---|---|---|---|
| Profile import | Implemented-unproven | ❓ | ❓ | ❓ | ❓ | — | #346 |
| Recent media import (25–50 objects) | Implemented-unproven | ❓ | ❓ | ❓ | ❓ | Max 50 on first sync | #346 |
| Media children (carousel) | Implemented-unproven | ❓ | ❓ | ❓ | ❓ | — | #346 |
| Media product type | Implemented-unproven | ❓ | ❓ | ❓ | ❓ | VIDEO vs REELS type | #346 |
| Captions | Implemented-unproven | ❓ | ❓ | ❓ | ❓ | May differ if edited on Instagram | #346 |
| Timestamps (UTC → Asia/Tehran) | Implemented-unproven | ❓ | ❓ | ❓ | ❓ | — | #346 |
| Permalinks | Implemented-unproven | ❓ | ❓ | ❓ | ❓ | — | #346 |
| Available insights for media | Implemented-unproven | ❓ | ❓ | ❓ | ❓ | < 100 followers = unavailable | #346 |
| Conversation backfill | Implemented-unproven | ❓ | ❓ | ❓ | ❓ | Requests folder inactive > 30 days may not return | #346 |
| Cursor-based pagination | Implemented-unproven | ❓ | ❓ | ❓ | ❓ | — | #346 |
| Checkpoint / resume | ❓ | ❓ | ❓ | ❓ | ❓ | — | #346 |
| Duplicate prevention on rerun | ❓ | ❓ | ❓ | ❓ | ❓ | — | #346 |
| Partial success handling | ❓ | ❓ | ❓ | ❓ | ❓ | — | #346 |
| Imported origin field (`INSTAGRAM_IMPORT`) | ❓ | ❓ | ❓ | ❓ | ❓ | — | #346 |
| No accidental republish of imported content | ❓ | ❓ | ❓ | ❓ | ❓ | — | #346 |
| User-visible progress | ❓ | ❓ | ❓ | ❓ | ❓ | — | #346 |

---

## C. Media and composer

| Capability | Status | Tests | Limitation | Issue |
|---|---|---|---|---|
| Image upload | Implemented-unproven | ❓ | — | #349 |
| Video upload | Implemented-unproven | ❓ | — | #349 |
| Carousel ordering | Implemented-unproven | ❓ | Max 10 children | #349 |
| File format validation | Implemented-unproven | ❓ | — | #349 |
| File size validation | Implemented-unproven | ❓ | — | #349 |
| Aspect ratio validation | Implemented-unproven | ❓ | — | #349 |
| Corrupt file rejection | ❓ | ❓ | — | #349 |
| Signed URL lifecycle | Implemented-unproven | ❓ | URL expiry during publish | #349 |
| Abandoned upload cleanup | ❓ | ❓ | — | #349 |
| Draft save | Implemented-unproven | ❓ | — | #351 |
| Autosave (local + server) | ❓ | ❓ | — | #351 |
| Draft conflict resolution | ❓ | ❓ | — | #351 |
| Instagram preview | Implemented-unproven | ❓ | — | #349 |
| Caption / hashtag limits | Implemented-unproven | ❓ | 2,200 chars / 30 hashtags | #349 |
| Scheduling | Implemented-unproven | ❓ | — | #349 |
| Queue | Implemented-unproven | ❓ | — | #349 |
| Review mode | Implemented-unproven | ❓ | — | — |
| Persian mixed-direction text | Implemented-unproven | ❓ | — | — |
| Mobile composer | Implemented-unproven | ❓ | — | #351 |
| Keyboard accessibility | Implemented-unproven | ❓ | — | #160 |

---

## D. Publishing

| Capability | Status | Code path | Worker | Provider endpoint | Tests | Non-tester | Limitation | Issue |
|---|---|---|---|---|---|---|---|---|
| Image publication | Implemented-unproven | ❓ | ❓ | `/me/media` | ❓ | ❓ | — | #349 |
| Video publication | Implemented-unproven | ❓ | ❓ | `/me/media` | ❓ | ❓ | — | #349 |
| Reel publication | Implemented-unproven | ❓ | ❓ | `/me/media` (product type REELS) | ❓ | ❓ | VIDEO vs REELS type distinction | #349 |
| Carousel publication | Implemented-unproven | ❓ | ❓ | `/me/media` (album) | ❓ | ❓ | — | #349 |
| Story publication | Out-of-scope | — | — | — | — | — | Depends on login path | — |
| Container creation + status polling | Implemented-unproven | ❓ | ❓ | `/me/media` | ❓ | ❓ | — | #349 |
| Provider receipt (media ID) | Implemented-unproven | ❓ | ❓ | — | ❓ | ❓ | — | #349 |
| Provider permalink | Implemented-unproven | ❓ | ❓ | — | ❓ | ❓ | — | #349 |
| Retry on transient failure | Implemented-unproven | ❓ | ❓ | — | ❓ | ❓ | — | #350 |
| Rate limit handling (HTTP 429) | ❓ | ❓ | ❓ | — | ❓ | ❓ | — | #350 |
| Timeout → OUTCOME_UNKNOWN state | ❓ | ❓ | ❓ | — | ❓ | ❓ | — | #350 |
| Unknown outcome reconciliation | ❓ | ❓ | ❓ | — | ❓ | ❓ | — | #350 |
| Duplicate prevention | ❓ | ❓ | ❓ | — | ❓ | ❓ | — | #350 |
| Cancellation (before dispatch) | Implemented-unproven | ❓ | ❓ | — | ❓ | ❓ | — | #350 |
| Cancellation (during ambiguous processing) | ❓ | ❓ | ❓ | — | ❓ | ❓ | — | #350 |
| Worker crash recovery | ❓ | ❓ | ❓ | — | ❓ | ❓ | — | #350 |
| Queue restart recovery | ❓ | ❓ | ❓ | — | ❓ | ❓ | — | #350 |
| Dead-letter handling | ❓ | ❓ | ❓ | — | ❓ | ❓ | — | #350 |
| Manual repair action | ❓ | ❓ | — | — | ❓ | ❓ | — | #350 |
| Analytics linkage | Implemented-unproven | ❓ | — | — | ❓ | ❓ | — | #355 |

---

## E. Inbox

| Capability | Status | Code path | Webhook field | Tests | Limitation | Issue |
|---|---|---|---|---|---|---|
| Webhook signature verification | Implemented-unproven | ❓ | — | ❓ | — | #353 |
| Durable raw event storage | ❓ | ❓ | — | ❓ | — | #353 |
| Idempotency (duplicate webhook) | ❓ | ❓ | — | ❓ | — | #353 |
| Comment ingestion | Implemented-unproven | ❓ | `comments` | ❓ | — | #353 |
| Mention ingestion | Implemented-unproven | ❓ | `mentions` | ❓ | — | #353 |
| DM ingestion | Implemented-unproven | ❓ | `messages` | ❓ | — | #353 |
| Attachment display | Implemented-unproven | ❓ | `messages` | ❓ | Shared media may be URL only | #353 |
| Thread identity | Implemented-unproven | ❓ | — | ❓ | — | #353 |
| Conversation ordering | Implemented-unproven | ❓ | — | ❓ | — | #353 |
| Search | Implemented-unproven | ❓ | — | ❓ | — | — |
| Pagination | Implemented-unproven | ❓ | — | ❓ | — | — |
| Read / unread state | Implemented-unproven | ❓ | — | ❓ | — | — |
| DM reply (within 24-hour window) | Implemented-unproven | ❓ | — | ❓ | 24-hour reply window | #353 |
| 24-hour reply window enforcement | ❓ | ❓ | — | ❓ | Must block before provider call | #353 |
| Public comment reply | Implemented-unproven | ❓ | — | ❓ | — | #353 |
| Private reply (first, within 7 days) | Implemented-unproven | ❓ | — | ❓ | One private reply per commenter | #353 |
| Second private reply blocked | ❓ | ❓ | — | ❓ | Must block before provider call | #353 |
| Realtime updates | Implemented-unproven | ❓ | — | ❓ | — | #353 |
| Fallback polling | ❓ | ❓ | — | ❓ | — | #353 |
| Assignment | Implemented-unproven | ❓ | — | ❓ | — | #353 |
| Priority and tags | Implemented-unproven | ❓ | — | ❓ | — | #353 |
| Claim conflict handling | ❓ | ❓ | — | ❓ | — | #353 |
| Workspace isolation | Implemented-unproven | ❓ | — | ❓ | — | #353 |
| Historical limitation disclosed | ❓ | — | — | ❓ | Requests folder inactive > 30 days | #353 |

---

## F. Comment-to-DM automation

| Capability | Status | Code path | Worker | Tests | Limitation | Issue |
|---|---|---|---|---|---|---|
| Rule template (5 templates) | ❓ | ❓ | ❓ | ❓ | Generic builder under "Advanced" | #354 |
| Keyword normalization (ی/ی, ک/ك) | Implemented-unproven | ❓ | ❓ | ❓ | Documented policy required | #354 |
| Exact / partial match policy | ❓ | ❓ | ❓ | ❓ | Must be documented | #354 |
| Post-specific rules | Implemented-unproven | ❓ | ❓ | ❓ | — | #354 |
| Workspace-wide rules | Implemented-unproven | ❓ | ❓ | ❓ | — | #354 |
| One private reply per commenter | ❓ | ❓ | ❓ | ❓ | Meta hard limit | #354 |
| 7-day private reply window | ❓ | ❓ | ❓ | ❓ | Meta hard limit — must enforce before API call | #354 |
| 24-hour DM follow-up window | Implemented-unproven | ❓ | ❓ | ❓ | Meta rule | #354 |
| Duplicate event idempotency | ❓ | ❓ | ❓ | ❓ | — | #354 |
| Frequency caps | Implemented-unproven | ❓ | ❓ | ❓ | — | #354 |
| Public reply + DM (combined) | Implemented-unproven | ❓ | ❓ | ❓ | — | #354 |
| Partial failure visibility | ❓ | ❓ | ❓ | ❓ | — | #354 |
| Run history | Implemented-unproven | ❓ | ❓ | ❓ | — | #354 |
| Test mode | ❓ | ❓ | ❓ | ❓ | — | #354 |
| Kill switch (disable immediately) | Implemented-unproven | ❓ | ❓ | ❓ | — | #354 |
| Permission loss behavior | ❓ | ❓ | ❓ | ❓ | — | #354 |
| Abuse protection | ❓ | ❓ | ❓ | ❓ | — | #354 |

---

## G. Analytics

| Capability | Status | Code path | Provider field | Tests | Limitation | Issue |
|---|---|---|---|---|---|---|
| Account-level metrics | Implemented-unproven | ❓ | ❓ | ❓ | < 100 followers = unavailable | #355 |
| Media-level metrics | Implemented-unproven | ❓ | ❓ | ❓ | — | #355 |
| Follower count | Implemented-unproven | ❓ | `followers_count` | ❓ | — | #355 |
| Reach | Implemented-unproven | ❓ | `reach` | ❓ | — | #355 |
| Impressions | Implemented-unproven | ❓ | `impressions` | ❓ | — | #355 |
| Engagement | Implemented-unproven | ❓ | ❓ | ❓ | Definition must be documented | #355 |
| Clicks | ❓ | ❓ | ❓ | ❓ | Only if exact provider field exists for account type | #355 |
| UTC → Asia/Tehran conversion | Implemented-unproven | ❓ | — | ❓ | — | #355 |
| Data freshness label | ❓ | ❓ | — | ❓ | — | #355 |
| 90-day historical limit disclosed | ❓ | — | — | ❓ | Meta API stores 90 days | #355 |
| Empty dataset → not displayed as zero | ❓ | ❓ | — | ❓ | Meta may return empty, not null | #355 |
| Collector failure + retry | ❓ | ❓ | — | ❓ | — | #355 |
| Imported content vs Nashrino-published | ❓ | ❓ | — | ❓ | — | #355 |
| Native Insights comparison | ❓ | — | — | ❓ | < 5% variance target | #355 |
| Metric dictionary | ❓ | — | — | ❓ | — | #355 |

---

## H. Operations

| Capability | Status | Tests | Issue |
|---|---|---|---|
| Structured logs | Implemented-unproven | ❓ | #160 |
| Correlation IDs | Implemented-unproven | ❓ | #160 |
| Distributed trace (API → worker → provider) | ❓ | ❓ | #160 |
| Publish success/failure metrics | ❓ | ❓ | #160 |
| Duplicate detection metric | ❓ | ❓ | #160 |
| Oldest pending job metric | ❓ | ❓ | #160 |
| Webhook failure metric | ❓ | ❓ | #160 |
| Token expiry metric | ❓ | ❓ | #160 |
| Alert thresholds | ❓ | ❓ | #160 |
| Operator runbook | ❓ | ❓ | #160 |
| Backup verification | ❓ | ❓ | #160 |
| Restore verification | ❓ | ❓ | #160 |
| Rollback procedure | ❓ | ❓ | #160 |
| Incident process | ❓ | ❓ | #160 |

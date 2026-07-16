# Meta Commercial Access Checklist — Nashrino

**Last updated:** 2026-07-16
**Owner:** Reza
**Related issue:** #339 (Day 0), #343 (Week 1 Meta architecture decision)

> **ACTION REQUIRED:** Fill in every row marked ❓ by end of Day 0 (2026-07-17).
> If any Advanced Access field is blank, that is a launch blocker — open an issue immediately.

---

## 1. App identity

| Field | Value |
|---|---|
| App ID | ❓ |
| App name | ❓ |
| App mode | ❓ Development / Live |
| App dashboard URL | ❓ |
| Meta Business Account linked | ❓ Yes / No |
| Business Verification status | ❓ Verified / Pending / Not started / Rejected |
| Business Verification submitted | ❓ Date if pending |
| Business Verification blocker | ❓ What is blocking if not started |

---

## 2. Login flow decision

| Field | Value |
|---|---|
| Currently implemented path | **Hybrid** — auth at `api.instagram.com/oauth/authorize` (Instagram Login endpoint) but old-style Facebook-path scopes + `graph.facebook.com` for all API calls |
| Auth endpoint (code: `oauth-adapters.ts:54`) | `https://api.instagram.com/oauth/authorize` |
| API origin (code: `shared/instagram-graph.ts:3`) | `https://graph.facebook.com` (Facebook Graph API) |
| PKCE used | Yes — S256, mandatory (`oauth-adapters.ts:51`) |
| Long-lived token exchange | Yes — `fb_exchange_token` grant (`oauth-adapters.ts:86`) |
| Primary path selected for 30-day plan | ❓ **DECISION REQUIRED** — see PRODUCT_DECISION_LOG.md DEC-001 |
| Reason for selection | ❓ |
| Decision logged in PRODUCT_DECISION_LOG.md | ☐ DEC-001 |

> ⚠️ **Architecture flag (code-derived):** The implementation requests `pages_show_list` and `pages_read_engagement` — these are Facebook Page-level permissions. They require the Instagram account to have a linked Facebook Page. Users with a standalone Instagram Business account (no linked Page) will likely fail at this step. Verify whether `api.instagram.com` honors Page-level scopes or silently drops them. This may mean the effective path is Facebook Login despite the auth URL. **Confirm in the Week 1 non-tester account test (#345).**

---

## 3. Permissions and access level

### Active permissions (currently in code — `src/lib/provider-auth/types.ts:167`)

| Permission | Standard Access | Advanced Access | Required for | App Review status |
|---|---|---|---|---|
| `instagram_basic` | ✅ (test-only) | ❓ | Account connection, profile read | ❓ |
| `instagram_content_publish` | ✅ (test-only) | ❓ | All publishing (feed, Reels, Stories, carousel) | ❓ |
| `pages_show_list` | ✅ (test-only) | ❓ | List Pages (needed if Facebook Login path) | ❓ |
| `pages_read_engagement` | ✅ (test-only) | ❓ | Read Page content + analytics | ❓ |
| `instagram_manage_comments` | ✅ (test-only) | ❓ | Comment inbox, public reply | ❓ |
| `instagram_manage_messages` | ✅ (test-only) | ❓ | DM inbox, private reply, comment-to-DM | ❓ |

> "Standard Access (test-only)" means: works for app testers/developers in Development mode. **Non-tester professional accounts require Advanced Access AND App Review approval for `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_messages`.** This is the #1 launch blocker.

### Instagram Login v2 permissions (if migrating path)

| Permission | Standard Access | Advanced Access | Required for | App Review status |
|---|---|---|---|---|
| `instagram_business_basic` | ❓ | ❓ | Account connection, health check | ❓ |
| `instagram_business_content_publish` | ❓ | ❓ | All publishing | ❓ |
| `instagram_business_manage_messages` | ❓ | ❓ | DM inbox, private reply | ❓ |
| `instagram_business_manage_comments` | ❓ | ❓ | Comment inbox, public reply | ❓ |
| `instagram_business_manage_insights` | ❓ | ❓ | Analytics (account + media metrics) | ❓ |

> These are the new-style scopes for the pure Instagram Login path (no Facebook Page required). DEC-001 must decide whether to stay on old-style or migrate.

**Advanced Access status key:** Granted ✅ / In review 🔄 / Not requested ❌ / Rejected ⛔

---

## 4. Graph API version

| Field | Value |
|---|---|
| Version currently in use | `v25.0` (default in `shared/instagram-graph.ts:2`, overridable via `INSTAGRAM_GRAPH_API_VERSION` env var) |
| Version sunset date | ❓ (check https://developers.facebook.com/docs/graph-api/changelog/) |
| Within 90-day risk window? | ❓ Yes / No |
| Upgrade issue created | ❓ Issue number or N/A |

---

## 5. Webhook subscriptions

Webhook subscription happens **per-account** (not app-level) immediately after OAuth callback succeeds, via `POST /{igUserId}/subscribed_apps` (`src/modules/oauth/service.ts:206`). This requires Advanced Access — subscription is best-effort and swallows failures silently.

| Level | Field | Callback URL | Verify token location | Status |
|---|---|---|---|---|
| Per-account (`/subscribed_apps`) | `comments` | `/api/inbox/instagram/webhook` | ❓ Env var name | ❓ Active / Inactive |
| Per-account (`/subscribed_apps`) | `messages` | `/api/inbox/instagram/webhook` | ❓ | ❓ |
| Per-account (`/subscribed_apps`) | `mentions` | `/api/inbox/instagram/webhook` | ❓ | ❓ |

> App-level webhook (Meta App Dashboard) must also be configured pointing to `/api/inbox/instagram/webhook`. The per-account `/subscribed_apps` call activates delivery for that specific account. Both are required.

---

## 6. Non-tester account test status

| Account type | Test status | Date | Commit SHA | Result |
|---|---|---|---|---|
| Business (non-tester) | ❓ Untested / Pass / Fail | | | |
| Creator (non-tester) | ❓ Untested / Pass / Fail | | | |

> If **Untested**: this is the highest-priority test in Week 1 (issue #345, due Thursday 2026-07-24).
> If **Fail**: this is a critical launch blocker — open a blocking issue immediately.

---

## 7. Test accounts

| Account | Type | Instagram account username | Provider account ID | Purpose |
|---|---|---|---|---|
| nashrino_test_business | Business + Facebook Page | ❓ | ❓ | Publishing, inbox, analytics certification |
| nashrino_test_creator | Creator | ❓ | ❓ | Creator path certification |
| nashrino_test_commenter | Personal | ❓ | N/A | Send test comments and DMs |

> Credentials are **never** stored in this repository. Store in your password manager.

---

## 8. App Review

The following permissions require App Review for Advanced Access (non-tester accounts):

| Permission | Submission date | Submission link | Expected decision date | Status |
|---|---|---|---|---|
| `instagram_content_publish` | ❓ | ❓ | ❓ | ❓ |
| `instagram_manage_messages` | ❓ | ❓ | ❓ | ❓ |
| `instagram_manage_comments` | ❓ | ❓ | ❓ | ❓ |
| `pages_read_engagement` | ❓ | ❓ | ❓ | ❓ |

> Typical App Review timeline: 5–15 business days.
> If not submitted: this must happen immediately. It is a hard launch blocker.
> If DEC-001 selects new-style Instagram Login v2, replace with `instagram_business_*` equivalents above.

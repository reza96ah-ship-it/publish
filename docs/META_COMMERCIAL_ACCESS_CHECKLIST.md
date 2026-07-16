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
| Currently implemented path | ❓ Instagram Login (`graph.instagram.com`) / Facebook Login (`graph.facebook.com`) |
| Primary path selected for 30-day plan | ❓ |
| Reason for selection | ❓ |
| Decision logged in PRODUCT_DECISION_LOG.md | ☐ DEC-001 |

---

## 3. Permissions and access level

### Instagram Login path permissions

| Permission | Standard Access | Advanced Access | Required for | App Review status |
|---|---|---|---|---|
| `instagram_business_basic` | ❓ | ❓ | Account connection, profile, health check | ❓ |
| `instagram_business_content_publish` | ❓ | ❓ | All publishing | ❓ |
| `instagram_business_manage_messages` | ❓ | ❓ | DM inbox, private reply, comment-to-DM | ❓ |
| `instagram_business_manage_comments` | ❓ | ❓ | Comment inbox, public reply | ❓ |
| `instagram_business_manage_insights` | ❓ | ❓ | Analytics (account + media metrics) | ❓ |

### Facebook Login path permissions (if used)

| Permission | Standard Access | Advanced Access | Required for | App Review status |
|---|---|---|---|---|
| `pages_show_list` | ❓ | ❓ | List connected Pages | ❓ |
| `instagram_basic` | ❓ | ❓ | Basic account access | ❓ |
| `instagram_content_publish` | ❓ | ❓ | Publishing | ❓ |
| `pages_read_engagement` | ❓ | ❓ | Page engagement | ❓ |
| `instagram_manage_comments` | ❓ | ❓ | Comment management | ❓ |
| `instagram_manage_messages` | ❓ | ❓ | DM management | ❓ |
| `pages_messaging` | ❓ | ❓ | Page messaging | ❓ |

**Advanced Access status key:** Granted ✅ / In review 🔄 / Not requested ❌ / Rejected ⛔

---

## 4. Graph API version

| Field | Value |
|---|---|
| Version currently in use | ❓ (e.g., v25.0) |
| Version sunset date | ❓ (from Meta changelog) |
| Within 90-day risk window? | ❓ Yes / No |
| Upgrade issue created | ❓ Issue number or N/A |

---

## 5. Webhook subscriptions

| Subscription | Field | Callback URL | Verify token location | Status |
|---|---|---|---|---|
| ❓ Account / App | `comments` | ❓ | ❓ Env var name | ❓ Active / Inactive |
| ❓ Account / App | `messages` | ❓ | ❓ | ❓ |
| ❓ Account / App | `mentions` | ❓ | ❓ | ❓ |

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

| Permission | Submission date | Submission link | Expected decision date | Status |
|---|---|---|---|---|
| `instagram_business_content_publish` | ❓ | ❓ | ❓ | ❓ |
| `instagram_business_manage_messages` | ❓ | ❓ | ❓ | ❓ |
| `instagram_business_manage_comments` | ❓ | ❓ | ❓ | ❓ |
| `instagram_business_manage_insights` | ❓ | ❓ | ❓ | ❓ |

> Typical App Review timeline: 5–15 business days.
> If not submitted: this must happen immediately. It is a hard launch blocker.

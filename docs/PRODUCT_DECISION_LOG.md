# Product Decision Log — Nashrino

**Format:** Each decision is immutable once closed. Add new decisions at the bottom.
**Owner:** Reza
**Authority:** Execution plan §21 (Decision log)

---

## Decision template

```
Decision ID:   DEC-NNN
Date:          YYYY-MM-DD
Owner:         Name
Status:        OPEN | CLOSED | REVERSED

Question:      What decision needs to be made?
Evidence:      What facts informed this decision?
Options:       What were the alternatives?
Chosen:        What was selected?
Why:           Reason for this choice over alternatives
Risks:         Known risks of this choice
Reversal trigger: What evidence would cause us to reverse?
Review date:   When to re-evaluate
Related issues: GitHub issue numbers
```

---

## Required decisions (to be logged as each is made)

- [x] DEC-001 — Primary Meta login flow (Instagram Login vs Facebook Login) ← CLOSED 2026-07-17
- [ ] DEC-002 — Provisional customer segment
- [ ] DEC-003 — Supported content types for pilot
- [ ] DEC-004 — Default navigation (current vs proposed simplified)
- [ ] DEC-005 — Primary differentiator (Hypothesis A, B, or C)
- [ ] DEC-006 — Final first-market segment
- [ ] DEC-007 — Paid-beta go/no-go

---

## Closed decisions

### DEC-001 — Primary Meta login flow

```
Decision ID:   DEC-001
Date:          2026-07-17
Owner:         Reza
Status:        CLOSED

Question:      Which Instagram OAuth path should Nashrino use as its single
               primary path: Instagram API with Instagram Login (new, 2024+)
               or Instagram API with Facebook Login (legacy)?

Evidence:      Code audit of src/lib/provider-auth/oauth-adapters.ts revealed
               the codebase was using a hybrid: Instagram Login auth endpoint
               (api.instagram.com/oauth/authorize) but old-style Facebook Login
               scopes (instagram_basic, pages_show_list, pages_read_engagement)
               and graph.facebook.com as the API origin.
               - The pages_show_list + pages_read_engagement scopes require a
                 linked Facebook Page, blocking standalone Instagram accounts.
               - graph.facebook.com is the deprecated origin for Instagram data.
               - instagram_business_manage_insights is only available on the
                 new path — no dedicated analytics scope exists on the old path.
               - Meta announced the Facebook-Login path for Instagram is in
                 maintenance mode (no new features) as of v20.0 (2024).

Options:
  A. Instagram API with Instagram Login (2024+ path)
     - graph.instagram.com, instagram_business_* scopes
     - No Facebook Page required
     - Dedicated analytics scope (instagram_business_manage_insights)
     - Active development from Meta
  B. Instagram API with Facebook Login (legacy path)
     - graph.facebook.com, instagram_basic/pages_show_list/etc. scopes
     - Requires Facebook Page linked to Instagram account
     - Maintenance mode, no new features
     - Less complete analytics surface

Chosen:        A — Instagram API with Instagram Login

Why:           Path A does not require a Facebook Page, making it compatible
               with any Business or Creator account regardless of whether the
               owner has a linked Facebook Page. This removes a silent
               connection blocker for a significant share of Iranian SMM
               users. It is also the path Meta is actively developing, has a
               dedicated analytics scope, and avoids building on a deprecated
               permission set. The code change delta was small (scope names +
               token exchange URL), making migration low-risk.

Risks:         Advanced Access is still required for all 5 instagram_business_*
               permissions. App Review may take 5-15 business days. Until
               Advanced Access is granted, only app testers can connect.

Reversal trigger: Meta deprecates graph.instagram.com or introduces a breaking
               change that requires falling back to Facebook Login. Confidence:
               very low — this is the official forward path.

Review date:   2026-08-17 (after App Review outcome)
Related issues: #343 (closed), #345 (Thursday non-tester test)
Commit:        01eaf72
```

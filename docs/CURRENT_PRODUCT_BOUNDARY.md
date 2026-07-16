# Current Product Boundary — Nashrino

**Effective:** 2026-07-16
**Review date:** 2026-08-14 (30-day decision review, issue #357)
**Owner:** Reza
**Authority:** GitHub issue #160 (engineering gates), 30-day execution plan milestones #39–#43

---

## One-sentence definition

Nashrino is a Persian Instagram operations workspace for professional social-media managers and small teams: connect, plan, publish, manage conversations, automate repetitive replies, and understand performance.

---

## What we are building now

Work in any of these categories is accepted:

1. Instagram connection (OAuth, permissions, token health)
2. Account and permission verification
3. Media publishing (image, video, reel, carousel)
4. Scheduling and queue
5. Publishing state accuracy
6. Retry and duplicate safety
7. Unknown-outcome reconciliation
8. Comments and direct messages
9. Comment-to-DM automation
10. Analytics correctness
11. Token health and reconnection
12. Security and tenant isolation
13. Error recovery and repair actions
14. Mobile usability
15. Accessibility (WCAG 2.2 AA for core workflows)
16. Testing and certification evidence
17. Deployment safety, observability, and backup

---

## What is paused

Do not start or expand:

- Sales CRM, orders, products, inventory, payments
- Creator sponsorship and deal management
- New social networks (Telegram, LinkedIn, Rubika, Bale, Eitaa, WhatsApp)
- Broad AI expansion beyond current composer assistance
- Marketplace features
- New agency capabilities beyond what currently exists
- Advanced listening features
- Ads management
- Native mobile applications
- Complete PWA expansion
- Full visual redesign
- Public pricing page
- Large marketing launch

---

## What is preserved but hidden

These modules exist in the repository and must not be deleted or rewritten. Hide them behind role or feature flags if usability evidence supports it. Do not add new functionality to them during this phase.

- Agency workspaces and client portal
- Social listening
- Generic automation builder
- Advanced campaigns
- Smart Pages
- Non-Instagram provider implementations

---

## Core journey we are certifying

1. User signs up and enters a workspace.
2. User connects an Instagram professional account.
3. Nashrino verifies identity, permissions, scopes, account type, and token health.
4. User creates a post and uploads valid media.
5. User previews the Instagram result.
6. User publishes immediately or schedules the post.
7. Nashrino displays the publication state truthfully.
8. Instagram acknowledges the publication.
9. Comments, mentions, and direct messages arrive in Nashrino.
10. User replies successfully.
11. Comment-to-DM automation executes safely.
12. Analytics are collected accurately.
13. Failures show a clear recovery action.
14. Token expiry or permission loss shows a clear reconnect action.

---

## Rules for accepting new work

A proposed issue is accepted only if it directly improves one of the 17 active categories above.

Ask: "Does this make the core Instagram journey more reliable, truthful, recoverable, or testable?"

If the answer is no, add it to `docs/PRODUCT_PARKING_LOT.md` and the [Product Parking Lot milestone](https://github.com/reza96ah-ship-it/publish/milestone/44).

---

## WIP limit

At any moment:
- Maximum **2 active engineering issues**
- Maximum **1 active research question**
- Maximum **1 pilot-experience improvement**
- No more than **4 active items total**

---

## Related documents

- [`docs/PRODUCT_PARKING_LOT.md`](./PRODUCT_PARKING_LOT.md) — deferred features
- [`docs/META_COMMERCIAL_ACCESS_CHECKLIST.md`](./META_COMMERCIAL_ACCESS_CHECKLIST.md) — Instagram API status
- [`docs/PRODUCT_DECISION_LOG.md`](./PRODUCT_DECISION_LOG.md) — strategic decisions
- [`docs/INSTAGRAM_CORE_CERTIFICATION_MATRIX.md`](./INSTAGRAM_CORE_CERTIFICATION_MATRIX.md) — evidence per capability
- GitHub issue [#160](https://github.com/reza96ah-ship-it/publish/issues/160) — engineering gate authority

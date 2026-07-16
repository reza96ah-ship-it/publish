# 30-Day Execution Plan — Nashrino

**Start:** 2026-07-16
**Decision date:** 2026-08-14 (issue #357)
**Owner:** Reza
**WIP limit:** ≤ 2 engineering issues + ≤ 1 research question + ≤ 1 pilot improvement = 4 total

---

## Objective

Prove three things in parallel:
1. **Provider feasibility** — real non-tester Instagram professional accounts can connect and use the required APIs
2. **Product reliability** — the core journey is truthful, durable, recoverable, and safe from duplicates
3. **Customer value** — a clearly defined Iranian user will replace an existing workflow and credibly pay for Nashrino

---

## Day 0 — Jul 16–17 · Scope Freeze & Current Truth
[Milestone #39](https://github.com/reza96ah-ship-it/publish/milestone/39)

- [ ] #337 — Scope freeze: classify every open issue
- [ ] #338 — Create 8 required product documents
- [ ] #339 — Meta app status snapshot (requires Meta dashboard access)
- [ ] #340 — Recruit 5 qualified research participants
- [ ] #341 — Set up Instagram test accounts and evidence folder

**Stop condition:** Do not write new feature code until #337 is closed.

---

## Week 1 — Jul 20–24 · Customer Truth & Meta Feasibility
[Milestone #40](https://github.com/reza96ah-ship-it/publish/milestone/40)

- [ ] #342 — Competitor benchmark: Nashrino vs Novinhub vs Buffer vs Planable vs Manychat (Monday)
- [ ] #343 — Meta architecture decision: primary login path + permission map (Tuesday)
- [ ] #344 — Research Round 1: 5 user interviews (Wednesday + Friday)
- [ ] #345 — **CRITICAL**: Non-tester Instagram professional account connection test (Thursday)

**Week 1 decision gate:**
- Continue when: #345 passes or has a clear App Review path, and ≥ 3 research participants confirm a relevant workflow
- Pause when: Meta commercial access is fundamentally blocked or the user segment has no assumed workflow

---

## Week 2 — Jul 27–31 · Connection, Sync & Activation
[Milestone #41](https://github.com/reza96ah-ship-it/publish/milestone/41)

- [ ] #346 — Write INITIAL_SYNC_SPEC.md + implement/verify initial sync (Monday–Wednesday)
- [ ] #347 — Connection certification: 12 test cases with evidence (Tuesday)
- [ ] #348 — Research Round 2: 6 sessions on connection + first value (Thursday–Friday)

**Week 2 targets:**
- Business + creator accounts connect with non-tester accounts
- First real data within 5 minutes after authorization (p50)
- ≥ 80% task completion on connection tasks
- No duplicate imports on sync rerun

---

## Week 3 — Aug 3–7 · Publishing, Resilience & Pilot Start
[Milestone #42](https://github.com/reza96ah-ship-it/publish/milestone/42)

- [ ] #349 — Publishing certification: image, video, reel, carousel (Monday)
- [ ] #350 — Failure + duplicate test matrix: 12 scenarios (Tuesday)
- [ ] #351 — Iranian connectivity resilience: dual draft, resumable upload, export (Wednesday)
- [ ] #352 — Pilot launch: onboard 3 participants (Thursday)

**Week 3 targets (pre-pilot minimum):**
- 10 successful image publications with provider receipts
- 10 successful video/Reel publications
- 10 successful carousel publications
- 10 scheduled publications
- 0 known duplicates
- 0 silently lost accepted publications

---

## Week 4 — Aug 10–14 · Inbox, Analytics, Pricing & Decision
[Milestone #43](https://github.com/reza96ah-ship-it/publish/milestone/43)

- [ ] #353 — Inbox certification: 100 webhook events (Monday)
- [ ] #354 — Comment-to-DM certification: templates + 50 controlled comments (Tuesday)
- [ ] #355 — Analytics validation: 20 media, native comparison, metric dictionary (Wednesday)
- [ ] #356 — Pricing + switching tests: 3 packages, price commitments (Thursday)
- [ ] #357 — **30-day decision review: choose path A/B/C/D** (Friday)

---

## Four paths (decision due 2026-08-14)

| Path | Choose when |
|---|---|
| A — In-house Instagram operations | Approval, inbox ownership, reliability, internal reporting dominate |
| B — Boutique agency operations | Client workspaces, approvals, multi-account, reports dominate |
| C — Solo professional simplified | Teams don't convert but solo managers strongly value publishing + inbox + simple automation |
| D — Stop and reframe | Meta access blocked, reliability fails, or no segment shows credible switching behavior |

**Rule: choose exactly one path.**

---

## Daily operating checklist

### Start of day
- [ ] Read active #160 items
- [ ] Confirm WIP limit (≤ 4 active items)
- [ ] Identify one user or provider uncertainty to reduce today
- [ ] Define today's evidence output

### Before coding
- [ ] Link capability matrix row in `INSTAGRAM_CORE_CERTIFICATION_MATRIX.md`
- [ ] Link GitHub issue
- [ ] Define expected state, failure state, and recovery
- [ ] Check tenant security and Meta permission
- [ ] Check migration / rollback impact

### End of day
- [ ] Update certification matrix rows touched today
- [ ] Update issue with any evidence collected
- [ ] Record any provider request / receipt IDs
- [ ] Select tomorrow's single highest-risk task

### Friday weekly review (answer these 8 questions)
1. What did we learn about customer value?
2. What did we prove about Meta feasibility?
3. What became more reliable?
4. Which user task improved?
5. What did a pilot actually use?
6. What generated support burden?
7. What should stop?
8. What is the single next uncertainty?

---

## Risk register (review every Friday)

| Risk | Probability | Impact | Early signal | Mitigation | Stop trigger |
|---|---|---|---|---|---|
| Advanced Access fails for non-testers | High | Critical | Non-tester API errors in #345 | App Review, primary login path | No commercial pilot |
| Duplicate external publication | Medium | Critical | Same provider IDs on two posts | Idempotency, receipts, reconciliation | Suspend publishing |
| Iran connectivity disruption | High | High | Upload failures, delayed sync | Resumable upload, queue persistence, export | Pause time-sensitive pilot claims |
| Wrong customer segment | Medium | High | Low repeat usage in pilot | Research every 2 weeks, price tests | Reframe segment |
| Novinhub parity trap | High | High | Users see no switching reason | Choose one differentiator by Week 1 | Do not launch generic all-in-one |
| Excessive product complexity | High | Medium | Navigation failures in usability sessions | Progressive disclosure | Shell simplification |
| Support burden | Medium | High | > 60 min/account/week | Better onboarding, diagnostics | Reduce pilot scope |
| Privacy breach | Low | Critical | Cross-tenant or secret exposure | ASVS L2, audit, data minimization | Stop pilot |
| Metrics misleading | Medium | High | Native Insights mismatch | Metric dictionary, empty ≠ zero | Hide metric |
| Scope drift | High | High | New unrelated issues opened | WIP limit, parking lot | Reject work |

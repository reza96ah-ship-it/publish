# Release Gate Checklist — Issue #153

A release candidate must pass ALL of the following before deployment.

## Pre-release verification

- [ ] Exact release SHA is recorded and immutable
- [ ] `git status` is clean — no uncommitted changes
- [ ] All PRs targeting this release are merged

## Tier 1 — Static and unit tests

- [ ] `bun run typecheck` — zero errors (app + worker + realtime)
- [ ] `bun run lint` — zero errors (warnings acceptable for non-release branches)
- [ ] `bun run test` — all unit + contract tests green
- [ ] No quarantined or skipped tests that are release-blocking

## Tier 2 — PostgreSQL integration tests

- [ ] `bun run test:integration` — all DB integration tests green
- [ ] Migrations run cleanly on a blank PostgreSQL database
- [ ] Transaction rollback tests pass
- [ ] Cross-workspace isolation tests pass
- [ ] Publication creation transaction tests pass
- [ ] Outbox claim/lease tests pass

## Tier 3 — Redis/BullMQ integration tests

- [ ] `bun run test:integration` — all Redis integration tests green
- [ ] Enqueue/delay/reschedule/cancel tests pass
- [ ] Deterministic job ID tests pass
- [ ] Retry/backoff tests pass
- [ ] Graceful shutdown tests pass

## Tier 4 — Provider contract tests

- [ ] `bun run test:contract` — all provider contract tests green
- [ ] Telegram: success, auth, rate-limit, timeout, malformed
- [ ] LinkedIn: success (201 + x-restli-id), auth, permission, rate-limit, server-error, timeout
- [ ] Instagram: success, auth (code 190), permission (code 200), rate-limit (code 4), validation, timeout

## Tier 5 — Application E2E

- [ ] `bun run test:e2e` — all E2E tests green
- [ ] Sign in / sign out flow
- [ ] Workspace isolation and role permissions
- [ ] Invite/accept/revoke member
- [ ] Upload/validate/delete media
- [ ] Autosave/restore
- [ ] Submit for review, approve/reject
- [ ] Immediate publish, schedule, reschedule, cancel
- [ ] No test passes by accepting 401/404 (Issue #153 requirement)

## Tier 6 — Browser/accessibility matrix

- [ ] Chromium desktop — all E2E green
- [ ] Firefox desktop — all E2E green (except accessibility.spec.ts)
- [ ] WebKit desktop — all E2E green (except accessibility.spec.ts)
- [ ] Mobile Chrome (Pixel 7) — all E2E green
- [ ] Mobile Safari (iPhone 14) — all E2E green
- [ ] RTL/Persian locale verified
- [ ] axe accessibility scans pass on core pages

## Tier 7 — Failure injection and chaos

- [ ] `bun run test:chaos` — all chaos tests green (when infrastructure is ready)
- [ ] PostgreSQL unavailable/reconnect — worker survives
- [ ] Redis unavailable/restart — outbox events not lost
- [ ] Worker crash at each publication crash window — no duplicate posts
- [ ] Provider timeout — outcome_unknown, not blind retry
- [ ] Expired credentials during delayed job — auth error, not retry

## Tier 8 — Load and soak

- [ ] k6 load test passes with authenticated requests (no 401-as-success)
- [ ] API acceptance latency p95 < 500ms
- [ ] Error rate < 1%
- [ ] Queue acceptance + worker throughput measured

## Security scans

- [ ] `bun audit --level critical` — no unacceptable critical CVEs
- [ ] Trufflehog secret scan — clean
- [ ] CodeQL static analysis — clean
- [ ] License check — no GPL-3.0/AGPL-3.0
- [ ] Trivy container scan — no HIGH/CRITICAL CVEs

## Docker and deployment

- [ ] All 4 Docker images build (app, worker, realtime, migrate)
- [ ] Migration image runs successfully on blank database
- [ ] Deploy workflow gated on CI success (workflow_run)
- [ ] SHA deployed matches SHA tested
- [ ] Post-deploy smoke tests pass (health, readiness, auth)
- [ ] Rollback drill recorded

## Go/No-Go

- [ ] All P0 gates closed with evidence
- [ ] Required P1 gates closed or explicitly risk-accepted
- [ ] Error budget and staging soak support launch
- [ ] Rollback decision owner is present
- [ ] Controlled rollout limits are configured

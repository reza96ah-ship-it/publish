# Release Gate Checklist

## 8-Tier Test Pyramid

### Tier 1 — Static & Unit
- [ ] TypeScript strict mode passes for app, worker, realtime
- [ ] ESLint: 0 errors, 0 warnings
- [ ] Unit tests: all pass (reducers, validators, permissions, error normalization)

### Tier 2 — PostgreSQL Integration
- [ ] Migrations from blank database pass
- [ ] Transaction rollback test passes
- [ ] Cross-workspace isolation test passes
- [ ] Outbox claim/lease behavior passes

### Tier 3 — Redis/BullMQ Integration
- [ ] Enqueue/delay/cancel test passes
- [ ] Deterministic job IDs verified
- [ ] Stalled job recovery passes
- [ ] Dead-letter and replay passes

### Tier 4 — Provider Contracts
- [ ] Fixtures for all result classes (success, auth, rate-limit, timeout, malformed)
- [ ] LinkedIn, Instagram, Telegram contract tests pass

### Tier 5 — Application E2E
- [ ] Sign in, MFA, logout flow
- [ ] Compose, autosave, publish flow
- [ ] Schedule, reschedule, cancel flow
- [ ] Operator dead-letter/replay flow

### Tier 6 — Browser/Accessibility Matrix
- [ ] Chromium, Firefox, WebKit desktop
- [ ] Mobile Chrome, Mobile Safari
- [ ] Axe accessibility scan passes
- [ ] Keyboard-only flow passes

### Tier 7 — Failure Injection & Chaos
- [ ] PostgreSQL connection failure recovery
- [ ] Redis connection failure recovery
- [ ] Worker crash window tests
- [ ] Provider timeout classification

### Tier 8 — Load & Soak
- [ ] k6 load test: p95 < 500ms, error rate < 1%
- [ ] Authenticated requests only (no 401-as-success)
- [ ] Soak test: no resource leaks over 1 hour

## Release Gates (all must pass)
- [ ] Zero lint/type/build errors
- [ ] All unit/integration/contract/E2E tests green
- [ ] All blocking security scans green
- [ ] Migration tests green
- [ ] Performance/accessibility thresholds green
- [ ] No quarantined/flaky release-blocking test

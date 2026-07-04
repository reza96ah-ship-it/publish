# Alert Rules — Issue #155

All alerts use SLO burn-rate where possible, with fast-burn and slow-burn thresholds.
Every alert links to a runbook in `docs/operations/runbooks/`.

## Alert Definitions

### Fast-burn alerts (page immediately — 2x budget burn in 1h)

| Alert | Condition | Severity | Runbook |
|-------|-----------|----------|---------|
| `SLOFastBurnPublishCorrectness` | burn_rate > 2 over 1h | P1 | `runbooks/publish-failure.md` |
| `SLOFastBurnAPIAcceptance` | burn_rate > 2 over 1h | P1 | `runbooks/api-outage.md` |
| `DuplicatePostDetected` | `nashrino_duplicate_posts_total` increases | P0 | `runbooks/suspected-duplicate.md` |
| `DeadLetterGrowth` | `nashrino_dead_letter_count` increases by >5 in 1h | P1 | `runbooks/dead-letter.md` |
| `WorkerAbsent` | no worker heartbeat for 2min | P0 | `runbooks/worker-backlog.md` |
| `PostgreSQLDown` | `/api/readyz` returns 503 for 1min | P0 | `runbooks/database-outage.md` |
| `RedisDown` | worker health reports redis=disconnected for 1min | P0 | `runbooks/redis-outage.md` |

### Slow-burn alerts (notify — budget burn over 6h/24h)

| Alert | Condition | Severity | Runbook |
|-------|-----------|----------|---------|
| `SLOSlowBurnPublishCorrectness` | burn_rate > 1 over 6h | P2 | `runbooks/publish-failure.md` |
| `SLOSlowBurnSchedulePunctuality` | p95 delay > 60s over 6h | P2 | `runbooks/schedule-delay.md` |
| `UnknownOutcomeAccumulating` | `nashrino_unknown_outcomes_total{age_bucket=">24h"}` > 0 | P2 | `runbooks/unknown-outcome.md` |
| `TokenExpiryWarning` | credential health < 95% for 1h | P2 | `runbooks/expired-credentials.md` |
| `OutboxBacklogGrowing` | `nashrino_outbox_age_seconds` > 300 (5min) | P2 | `runbooks/worker-backlog.md` |
| `ExpiredLeaseAccumulating` | `nashrino_expired_leases_total` rate > 0 over 1h | P3 | `runbooks/worker-backlog.md` |

### Deployment alerts

| Alert | Condition | Severity | Runbook |
|-------|-----------|----------|---------|
| `DeployHealthCheckFailed` | post-deploy smoke test fails | P1 | `runbooks/broken-deployment.md` |
| `MigrationFailed` | `prisma migrate deploy` exits non-zero | P0 | `runbooks/failed-migration.md` |

## Severity Definitions

- **P0 (Critical):** Page on-call immediately. User impact. Response: <5min.
- **P1 (High):** Page on-call. Significant degradation. Response: <15min.
- **P2 (Medium):** Notify on-call (Slack/email). Watch trend. Response: <1h.
- **P3 (Low):** Informational. Review in next business hours.

## Notification Routes

- P0/P1: PagerDuty + Slack #alerts
- P2: Slack #alerts
- P3: Slack #alerts (muted)

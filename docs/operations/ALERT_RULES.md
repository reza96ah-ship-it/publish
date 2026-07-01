# Alert Rules

## Prometheus Alert Definitions

Alert rules are defined in `docs/operations/alerts/alerts.yml` (Prometheus rule file format).

## Alert Severity Levels
- **P0 (Critical)**: Page on-call immediately. User-facing impact.
- **P1 (High)**: Page on-call within 15 minutes. Likely user impact.
- **P2 (Medium)**: Ticket during business hours. No immediate user impact.

## Active Alerts

### SLO Burn Rate Alerts
| Alert | Severity | Condition | Runbook |
|-------|----------|-----------|--------|
| FastBurnP0 | P0 | SLO burn rate > 14.4x over 1h | [runbooks/publish-failure.md](runbooks/publish-failure.md) |
| SlowBurnP2 | P2 | SLO burn rate > 3x over 6h | [runbooks/publish-failure.md](runbooks/publish-failure.md) |

### Infrastructure Alerts
| Alert | Severity | Condition | Runbook |
|-------|----------|-----------|--------|
| PostgresDown | P0 | pg_up == 0 for 1m | [runbooks/database-outage.md](runbooks/database-outage.md) |
| RedisDown | P0 | redis_up == 0 for 1m | [runbooks/redis-outage.md](runbooks/redis-outage.md) |
| QueueBacklog | P1 | queue_depth > 1000 for 5m | [runbooks/worker-backlog.md](runbooks/worker-backlog.md) |
| DeadLetterGrowth | P1 | dead_letter_count increasing > 10/min | [runbooks/dead-letter.md](runbooks/dead-letter.md) |
| ExpiredLeases | P2 | expired_leases_count > 50 | [runbooks/dead-letter.md](runbooks/dead-letter.md) |

See `docs/operations/alerts/alerts.yml` for full Prometheus rule definitions.

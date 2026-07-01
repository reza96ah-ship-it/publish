# Dashboard Definitions — Issue #155

## 1. Executive Service Health
- Total publications today (counter)
- Success rate % (gauge)
- Active workspaces (gauge)
- Error budget remaining (gauge per SLO)
- Open alerts count (stat)

## 2. Publishing Funnel + Success by Provider
- Publications accepted (counter, grouped by provider)
- Publications completed (counter, grouped by provider + outcome)
- Publications failed (counter, grouped by error_category)
- Success rate by provider (percentage)
- Publication duration histogram (by provider)

## 3. Schedule Latency
- Schedule delay p50/p95/p99 (histogram quantiles)
- Delay distribution by provider
- Oldest pending scheduled publication (gauge)

## 4. Outbox/Queue/Worker
- Outbox pending count (gauge)
- Outbox oldest age (gauge — nashrino_outbox_age_seconds)
- Queue depth: waiting/active/delayed/failed (gauge)
- Worker in-flight jobs (gauge)
- Worker concurrency utilization (%)

## 5. Retries, Unknown Outcomes, Duplicates
- Retry count by error category (counter)
- Unknown outcome count by age bucket (counter)
- Duplicate post count (counter — target: zero)
- Reconciliation state distribution (gauge by state)
- Dead-letter count (gauge)

## 6. Credentials/Channel Health
- Active channels by provider (gauge)
- Expiring tokens (count of tokens expiring within 7 days)
- Expired tokens (count)
- Credential health by provider (gauge: 1=active, 0=expired)

## 7. API/Database/Redis/Storage
- HTTP request rate by route (counter)
- HTTP request latency p95 (histogram)
- DB query duration p95 (histogram)
- PgBouncer active connections (gauge)
- Redis memory usage (gauge)
- Redis connected clients (gauge)

## 8. Realtime Connections/Delivery
- Active WebSocket connections (gauge)
- Event delivery rate (counter)
- Event delivery latency (histogram)
- Redis adapter state (gauge: 1=connected, 0=degraded)

## 9. Frontend Web Vitals
- LCP p75 by device (histogram quantile)
- INP p75 by device (histogram quantile)
- CLS p75 by device (histogram quantile)
- Web Vitals rating distribution (good/needs-improvement/poor)

## 10. Release Comparison by SHA
- Deploy events timeline
- Error rate before/after deploy
- Latency p95 before/after deploy
- Publication success rate before/after deploy

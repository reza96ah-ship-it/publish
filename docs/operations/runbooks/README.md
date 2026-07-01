# Runbooks — Issue #155

## Database Outage
**Alert:** `PostgreSQLDown`
**Severity:** P0
**Diagnosis:**
```sql
-- Check connection
pg_isready -h postgres -p 5432 -U nashrino
-- Check active connections
SELECT count(*) FROM pg_stat_activity;
-- Check locks
SELECT * FROM pg_locks WHERE NOT granted;
```
**Safe Actions:**
1. Check `docker compose ps postgres` — is the container running?
2. If container is down: `docker compose restart postgres`
3. If disk full: check `df -h` and clean up
4. If too many connections: restart PgBouncer (`docker compose restart pgbouncer`)
5. If migration failed: see `runbooks/failed-migration.md`
**Rollback:** N/A — database is the source of truth
**User Communication:** "انتشار موقتاً متوقف شده است — در حال بازیابی"

## Redis Outage
**Alert:** `RedisDown`
**Severity:** P0
**Diagnosis:**
```bash
redis-cli -h redis-queue ping
redis-cli -h redis-cache ping
```
**Safe Actions:**
1. Check `docker compose ps redis-queue redis-cache`
2. Restart: `docker compose restart redis-queue redis-cache`
3. If queue Redis lost data: outbox events survive in PostgreSQL — dispatcher will re-enqueue
4. If cache Redis lost data: Socket.io clients reconnect automatically
**Rollback:** N/A — queue is reconstructible from PostgreSQL outbox

## Worker Backlog
**Alert:** `WorkerAbsent` or `OutboxBacklogGrowing`
**Severity:** P0/P2
**Diagnosis:**
```bash
curl http://worker:3002/health
# Check queue depth
curl http://worker:3002/board (password required)
```
**Safe Actions:**
1. Check if worker container is running: `docker compose ps worker`
2. Restart: `docker compose restart worker`
3. If backlog is large: increase `WORKER_CONCURRENCY` env var
4. If Redis is full: check `redis-cli info memory`
**Rollback:** N/A

## Publish Failure (High Rate)
**Alert:** `SLOFastBurnPublishCorrectness`
**Severity:** P1
**Diagnosis:**
```sql
-- Recent failures by provider
SELECT platform_type, error_category, count(*)
FROM "PublicationAttempt"
WHERE outcome IN ('retryable_failure', 'permanent_failure')
  AND "completedAt" > now() - interval '1 hour'
GROUP BY platform_type, error_category;
```
**Safe Actions:**
1. If auth errors: check token expiry (`SELECT type, status, "tokenExpiresAt" FROM "Platform" WHERE status='expired'`)
2. If rate-limit errors: reduce `WORKER_CONCURRENCY`
3. If network errors: check provider API status pages
4. If all providers failing: check network/DNS
**Rollback:** Cancel pending publications if needed

## Suspected Duplicate
**Alert:** `DuplicatePostDetected`
**Severity:** P0
**Diagnosis:**
```sql
-- Check for duplicate fingerprints
SELECT "requestFingerprint", count(*)
FROM "PublicationAttempt"
WHERE outcome = 'provider_success'
GROUP BY "requestFingerprint"
HAVING count(*) > 1;
```
**Safe Actions:**
1. Immediately reduce `WORKER_CONCURRENCY` to 1
2. Identify the affected provider
3. Check if the fingerprint includes attemptNumber (should NOT — Issue #149 fix)
4. If duplicates exist: manually delete the duplicate from the provider
5. File a P0 bug report
**Rollback:** Delete duplicate posts from provider platforms manually

## Dead Letter Accumulation
**Alert:** `DeadLetterGrowth`
**Severity:** P1
**Diagnosis:**
```bash
curl http://localhost:3000/api/outbox/dead-letter
```
**Safe Actions:**
1. Review dead-lettered events for common error patterns
2. Fix underlying cause (e.g., malformed payload, invalid config)
3. Replay via `POST /api/outbox/{id}/replay` (admin only)
4. If cause is persistent: cancel the affected publications

## Unknown Outcome
**Alert:** `UnknownOutcomeAccumulating`
**Severity:** P2
**Diagnosis:**
```sql
SELECT id, "providerPostId", "reconciliationStatus", "errorMessage"
FROM "Publication"
WHERE status = 'outcome_unknown'
  AND "updatedAt" < now() - interval '1 hour';
```
**Safe Actions:**
1. Check if provider API is responsive
2. Attempt reconciliation via `POST /api/publications/{id}/resolve`
3. If still unknown after 24h: mark as `confirm_failure` or `abandon`
4. Contact provider support if needed

## Expired Credentials
**Alert:** `TokenExpiryWarning`
**Severity:** P2
**Diagnosis:**
```sql
SELECT name, type, "tokenExpiresAt",
  EXTRACT(EPOCH FROM ("tokenExpiresAt" - now()))/86400 AS days_remaining
FROM "Platform"
WHERE "tokenExpiresAt" IS NOT NULL
  AND "tokenExpiresAt" < now() + interval '7 days'
ORDER BY "tokenExpiresAt";
```
**Safe Actions:**
1. Notify workspace admin to reconnect the channel
2. If token expires before reconnection: publications to that channel will fail with auth error
3. Reconnect via the provider OAuth flow

## Failed Migration
**Alert:** `MigrationFailed`
**Severity:** P0
**Diagnosis:**
```bash
docker compose -f compose.production.yaml logs migrate
```
**Safe Actions:**
1. DO NOT restart the app — previous version is still serving traffic
2. Review the migration SQL for errors
3. If migration is forward-only: fix the SQL and re-run
4. If migration is backward-compatible: rollback the code to previous SHA
5. If migration corrupted data: restore from backup

## Broken Deployment
**Alert:** `DeployHealthCheckFailed`
**Severity:** P1
**Safe Actions:**
1. Automated rollback should have triggered — check if it ran
2. If not: `./scripts/rollback.sh <previous-tag>`
3. Verify health after rollback: `curl https://$DOMAIN/api/health`
4. Review deploy logs for the failure cause

## Realtime Outage
**Alert:** Realtime health reports redis=disconnected
**Severity:** P2
**Safe Actions:**
1. Restart realtime: `docker compose restart realtime`
2. Clients will reconnect automatically
3. If Redis cache is down: see `runbooks/redis-outage.md`

## Security Incident
**Severity:** P0
**Safe Actions:**
1. Identify scope: which secrets/data were exposed
2. Rotate all affected secrets (NEXTAUTH_SECRET, EMIT_SECRET, ENCRYPTION_KEY_V*)
3. Check audit logs: `SELECT * FROM "AuditLog" WHERE action LIKE 'security.%' ORDER BY "createdAt" DESC`
4. Notify affected users
5. File incident report

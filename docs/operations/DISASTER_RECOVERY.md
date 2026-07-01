# Disaster Recovery Plan — Issue #158

## RPO and RTO targets

| Component | RPO | RTO |
|-----------|-----|-----|
| PostgreSQL | < 5 min (WAL) | < 30 min |
| Redis (queue) | 0 (reconstructible from outbox) | < 5 min |
| Redis (cache) | N/A | < 1 min |
| Object storage | < 24h | < 1h |
| Secrets/keys | 0 | < 1h (manual) |

## PostgreSQL backup
- Daily full backup (pg_dump or snapshot)
- Continuous WAL streaming for PITR
- 30-day full retention, 7-day WAL retention
- Encrypted at rest, separate availability zone

## Restore drill procedure
1. Provision clean PostgreSQL
2. Restore from latest backup
3. Replay WAL to desired point-in-time
4. Run `prisma migrate deploy`
5. Verify invariants (publication count = outbox count, no orphan members, no duplicate fingerprints)
6. Measure RPO + RTO

### Last drill: NOT YET PERFORMED

## Redis recovery
- Queue loss: outbox in PostgreSQL is source of truth; dispatcher re-enqueues
- Cache loss: disposable; clients auto-reconnect
- Verify no duplicate posts (stable fingerprints)

## Key rotation drill
1. Generate new key: `ENCRYPTION_KEY_V2=<new>`
2. Set `ACTIVE_ENCRYPTION_KEY_ID=v2`
3. Re-encrypt all Platform.tokenSecret
4. Verify old (V1) + new (V2) decrypt correctly
5. Remove V1

### Last drill: NOT YET PERFORMED

## Deployment rollback
- Automated: health check fails → rollback restores previous images (< 60s)
- Manual: set `IMAGE_TAG=<previous-sha>` + `docker compose up -d`
- DB migration rollback: forward-only (deploy previous code), compensating migration, or PITR

## Game day checklist (14 scenarios per issue #158)
- [ ] PostgreSQL unavailable 5min — worker survives
- [ ] PgBouncer unavailable — app degrades gracefully
- [ ] Redis queue unavailable 5min — outbox reconstructs
- [ ] Cache/realtime Redis unavailable — degrades without losing publishing truth
- [ ] Worker crash during publication — no duplicate
- [ ] Realtime service outage — reconnect storm handled
- [ ] Provider timeout — outcome_unknown
- [ ] Provider outage (5xx sustained) — retry with backoff, then dead-letter
- [ ] Token expiry during delayed job — auth error, not retry loop
- [ ] Object storage unavailable — media upload fails gracefully
- [ ] Failed migration — previous version continues
- [ ] Unhealthy new release — auto-rollback
- [ ] Partial deployment (app v2 + worker v1) — backward compatible
- [ ] Deploy rollback — < 60s
- [ ] Full restore — data integrity verified
- [ ] Unknown provider outcome — reconciliation/manual resolution

### Last game day: NOT YET PERFORMED

## Security assurance (OWASP ASVS L2)
- V1 Architecture: modular monolith ✅
- V2 Authentication: Argon2id, MFA, lockout ✅
- V4 Access control: RBAC 19 permissions ✅
- V6 Crypto: AES-256-GCM + key rotation ✅
- V9 Communications: HSTS, TLS, CSP nonce ✅
- V11 Business logic: idempotency, duplicate prevention ✅
- Independent penetration test: NOT YET PERFORMED

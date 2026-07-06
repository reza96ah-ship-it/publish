# Staging Acceptance Checklist

Use this checklist before promoting staging to production.

## Pre-Deploy

- [ ] All Phase 1 P0 issues resolved.
- [ ] All CI checks pass: lint, typecheck, test, build, security audit, Docker build.
- [ ] Docker image builds successfully: `docker build -t nashrino-app .`.
- [ ] `.env.production` has all required vars and no placeholders.
- [ ] `NEXTAUTH_SECRET` is a strong 32+ byte random string.
- [ ] `POSTGRES_PASSWORD` is set and is not a default value.
- [ ] `DATABASE_URL` points at PgBouncer: `pgbouncer:6432`, `pgbouncer=true`, `connection_limit=10`.
- [ ] `DIRECT_DATABASE_URL` points at direct PostgreSQL: `postgres:5432`.
- [ ] `DOMAIN` in `Caddyfile.prod` matches the production domain.

## Docker Compose Validation

- [ ] `docker compose -f compose.production.yaml config` validates.
- [ ] `docker compose -f compose.production.yaml up -d` starts all services.
- [ ] Migration service exits successfully with `prisma migrate deploy`.
- [ ] All services pass health checks within 60 seconds:
  - [ ] app: `GET /api/health` returns 200.
  - [ ] app: `GET /api/readyz` returns 200 with DB connected.
  - [ ] worker: `GET :3002/health` returns 200.
  - [ ] realtime: `GET :3003/health` returns 200.
  - [ ] postgres: `pg_isready -U nashrino -d nashrino` succeeds.
  - [ ] pgbouncer: `pg_isready -h pgbouncer -p 6432 -U nashrino -d nashrino` succeeds.
  - [ ] redis: `redis-cli ping` returns PONG.

## Database Validation

- [ ] `bunx prisma migrate deploy` runs cleanly on a fresh Postgres instance.
- [ ] `bunx prisma migrate status` shows no pending migrations.
- [ ] Application logs show PgBouncer URL usage for app/worker.
- [ ] Backup test: `./scripts/backup.sh` produces a valid `pg_dump` archive.
- [ ] Restore test: `./scripts/restore.sh ./backups/nashrino-backup-*.tar.gz` succeeds in staging.

## Smoke Tests

- [ ] Home page loads: `GET /` returns 200.
- [ ] Login works with staging credentials.
- [ ] Dashboard renders all panels.
- [ ] Compose view loads Tiptap editor and Jalali picker.
- [ ] Calendar view loads month grid and drag-drop chips.
- [ ] Inbox view loads message list.
- [ ] Analytics view loads charts.
- [ ] Channels view loads platform cards.
- [ ] Settings view loads.

## Security Checks

- [ ] `curl -I https://staging.domain.com/` shows:
  - [ ] `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
  - [ ] `X-Frame-Options: SAMEORIGIN`.
  - [ ] `Content-Security-Policy` has `frame-ancestors 'self'`, not `*`.
  - [ ] No `unsafe-eval` in `script-src`.
- [ ] Unauthenticated API request returns 401, not demo-mode data.
- [ ] Demo credentials do not work in production.
- [ ] SSL certificate is valid via Caddy/Let's Encrypt.

## Observability Checks

- [ ] `GET /api/metrics` returns Prometheus text format.
- [ ] `GET /api/health` returns uptime and version.
- [ ] No errors in `docker compose logs` for a 5-minute soak test.

## Rollback

- [ ] Previous image tag is available in GHCR.
- [ ] `./scripts/rollback.sh <previous-tag>` works in staging.

## Sign-Off

- [ ] All boxes checked.
- [ ] Deploy approved by: _______________
- [ ] Deploy date: _______________

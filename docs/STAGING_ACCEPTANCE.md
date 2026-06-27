# Staging Acceptance Checklist

**Use this checklist before promoting staging → production.**

## Pre-deploy

- [ ] All Phase 1 P0 issues resolved
- [ ] All CI checks pass (lint, typecheck, test, build, security audit)
- [ ] Docker image builds successfully (`docker build -t nashrino-app .`)
- [ ] `.env.production` has all required vars (no placeholders)
- [ ] `NEXTAUTH_SECRET` is a strong 32+ byte random string
- [ ] `DOMAIN` in Caddyfile.prod matches the production domain

## Docker Compose validation

- [ ] `docker compose -f compose.production.yaml config` validates
- [ ] `docker compose -f compose.production.yaml up -d` starts all services
- [ ] All services pass health checks within 60s:
  - [ ] app: `GET /api/health` → 200
  - [ ] app: `GET /api/readyz` → 200 (DB connected)
  - [ ] worker: `GET :3002/health` → 200
  - [ ] realtime: `GET :3003/health` → 200
  - [ ] redis: `redis-cli ping` → PONG

## Smoke tests

- [ ] Home page loads (`GET /` → 200)
- [ ] Login works (demo credentials in staging only)
- [ ] Dashboard renders (all 6 panels visible)
- [ ] Compose view loads (Tiptap editor, Jalali picker)
- [ ] Calendar view loads (month grid, drag-drop chips)
- [ ] Inbox view loads (message list)
- [ ] Analytics view loads (charts render)
- [ ] Channels view loads (platform cards)
- [ ] Settings view loads

## Security checks

- [ ] `curl -I https://staging.domain.com/` shows:
  - [ ] `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - [ ] `X-Frame-Options: SAMEORIGIN`
  - [ ] `Content-Security-Policy` has `frame-ancestors 'self'` (not `*`)
  - [ ] No `unsafe-eval` in `script-src`
- [ ] Unauthenticated API request returns 401 (not 200 demo-mode data)
- [ ] Demo credentials do NOT work in production
- [ ] SSL certificate is valid (Let's Encrypt via Caddy)

## Observability checks

- [ ] `GET /api/metrics` returns Prometheus format
- [ ] `GET /api/health` returns uptime + version
- [ ] No errors in `docker compose logs` for 5 minutes of soak test

## Backup + Rollback

- [ ] `./scripts/backup.sh` produces a valid backup
- [ ] Restore test: `./scripts/restore.sh ./backups/nashrino-backup-*.tar.gz` succeeds
- [ ] Previous image tag available in registry
- [ ] `./scripts/rollback.sh <previous-tag>` works (tested in staging)

## Sign-off

- [ ] All above boxes checked
- [ ] Deploy approved by: _______________
- [ ] Deploy date: _______________

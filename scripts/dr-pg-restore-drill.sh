#!/usr/bin/env bash
# DR Drill: PostgreSQL backup → restore → migrate → integrity check
#
# Validates that:
#   1. pg_dump produces a restorable backup
#   2. prisma migrate deploy succeeds on a clean restore
#   3. Data integrity invariants hold after restore
#
# Usage:
#   ./scripts/dr-pg-restore-drill.sh
#   ./scripts/dr-pg-restore-drill.sh --target-url postgresql://user:pass@host/db
#
# Environment:
#   DATABASE_URL      source database (required)
#   DIRECT_DATABASE_URL  optional, falls back to DATABASE_URL
#
# Requirements: psql, pg_dump, pg_restore, docker (if no --target-url), bunx
#
# Exit codes:
#   0  drill passed — all checks green
#   1  drill failed — check RESULT section output

set -euo pipefail

###############################################################################
# Config
###############################################################################
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DUMP_FILE="/tmp/nashrino-dr-drill-$(date +%Y%m%d-%H%M%S).dump"
DOCKER_CONTAINER="nashrino-dr-drill-$$"
TARGET_URL="${TARGET_DATABASE_URL:-}"
MANAGED_DOCKER=false
DRILL_START=$(date +%s)
PASS=0
FAIL=0

info()  { echo "[DR] $*"; }
ok()    { echo "[DR] ✓ $*"; ((PASS++)) || true; }
fail()  { echo "[DR] ✗ FAIL: $*" >&2; ((FAIL++)) || true; }
fatal() { echo "[DR] FATAL: $*" >&2; cleanup; exit 1; }

###############################################################################
# Parse args
###############################################################################
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-url)
      TARGET_URL="$2"
      shift 2
      ;;
    *)
      echo "Usage: $0 [--target-url postgresql://...]" >&2
      exit 1
      ;;
  esac
done

###############################################################################
# Validate env
###############################################################################
SOURCE_URL="${DIRECT_DATABASE_URL:-${DATABASE_URL:-}}"
[[ -z "$SOURCE_URL" ]] && fatal "DATABASE_URL is not set"

info "Source DB: ${SOURCE_URL%%@*}@... (credentials redacted)"

###############################################################################
# Cleanup
###############################################################################
cleanup() {
  if [[ "$MANAGED_DOCKER" == "true" ]]; then
    info "Stopping Docker container $DOCKER_CONTAINER"
    docker rm -f "$DOCKER_CONTAINER" > /dev/null 2>&1 || true
  fi
  rm -f "$DUMP_FILE"
}
trap cleanup EXIT

###############################################################################
# Step 1: pg_dump
###############################################################################
info "--- Step 1: pg_dump (custom format) ---"
DUMP_START=$(date +%s)
pg_dump --format=custom --no-password "$SOURCE_URL" -f "$DUMP_FILE" \
  || fatal "pg_dump failed"
DUMP_SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
DUMP_ELAPSED=$(( $(date +%s) - DUMP_START ))
ok "pg_dump succeeded: $DUMP_SIZE in ${DUMP_ELAPSED}s → $DUMP_FILE"

###############################################################################
# Step 2: Provision restore target
###############################################################################
info "--- Step 2: Provision restore target ---"
if [[ -z "$TARGET_URL" ]]; then
  info "No --target-url provided; spinning up Docker Postgres 16"
  command -v docker > /dev/null || fatal "docker is required when --target-url is not set"
  docker run -d \
    --name "$DOCKER_CONTAINER" \
    -e POSTGRES_DB=nashrino_dr_drill \
    -e POSTGRES_USER=drill \
    -e POSTGRES_PASSWORD=drill \
    -p 15432:5432 \
    postgres:16-alpine > /dev/null

  MANAGED_DOCKER=true
  TARGET_URL="postgresql://drill:drill@localhost:15432/nashrino_dr_drill"

  info "Waiting for Postgres to be ready..."
  for i in $(seq 1 20); do
    if pg_isready -h localhost -p 15432 -U drill > /dev/null 2>&1; then
      ok "Docker Postgres ready after ${i}s"
      break
    fi
    if [[ $i -eq 20 ]]; then
      fatal "Postgres did not become ready within 20s"
    fi
    sleep 1
  done
else
  info "Using provided target: ${TARGET_URL%%@*}@... (credentials redacted)"
fi

###############################################################################
# Step 3: pg_restore
###############################################################################
info "--- Step 3: pg_restore ---"
RESTORE_START=$(date +%s)
pg_restore --no-password --clean --if-exists --no-owner --no-privileges \
  -d "$TARGET_URL" "$DUMP_FILE" 2>&1 | grep -v "^pg_restore: warning" || true
RESTORE_ELAPSED=$(( $(date +%s) - RESTORE_START ))
ok "pg_restore completed in ${RESTORE_ELAPSED}s"

###############################################################################
# Step 4: prisma migrate deploy
###############################################################################
info "--- Step 4: prisma migrate deploy ---"
MIGRATE_START=$(date +%s)
(
  cd "$REPO_ROOT"
  DIRECT_DATABASE_URL="$TARGET_URL" DATABASE_URL="$TARGET_URL" \
    bunx prisma migrate deploy
) && MIGRATE_OK=true || MIGRATE_OK=false
MIGRATE_ELAPSED=$(( $(date +%s) - MIGRATE_START ))
if [[ "$MIGRATE_OK" == "true" ]]; then
  ok "prisma migrate deploy succeeded in ${MIGRATE_ELAPSED}s"
else
  fail "prisma migrate deploy failed"
fi

###############################################################################
# Step 5: Integrity checks via psql
###############################################################################
info "--- Step 5: Integrity checks ---"

psql_check() {
  local label="$1"
  local query="$2"
  local expected="$3"

  local result
  result=$(psql --no-password -t -A "$TARGET_URL" -c "$query" 2>&1) || {
    fail "$label — psql error: $result"
    return
  }
  result="${result// /}"
  if [[ "$result" == "$expected" ]]; then
    ok "$label = $result (expected $expected)"
  else
    fail "$label = $result (expected $expected)"
  fi
}

# 5a. No orphan WorkspaceMembers (workspace deleted but member row left behind)
psql_check \
  "Orphan WorkspaceMember rows" \
  'SELECT COUNT(*) FROM "WorkspaceMember" wm WHERE NOT EXISTS (SELECT 1 FROM "Workspace" w WHERE w.id = wm."workspaceId")' \
  "0"

# 5b. No duplicate publicationOperationId (idempotency key must be unique)
psql_check \
  "Duplicate publicationOperationId rows" \
  'SELECT COUNT(*) FROM (SELECT "publicationOperationId", COUNT(*) FROM "Publication" WHERE "publicationOperationId" IS NOT NULL GROUP BY "publicationOperationId" HAVING COUNT(*) > 1) t' \
  "0"

# 5c. No Publications referencing a missing PublishJob
psql_check \
  "Publications with missing parent PublishJob" \
  'SELECT COUNT(*) FROM "Publication" p WHERE NOT EXISTS (SELECT 1 FROM "PublishJob" pj WHERE pj.id = p."publishJobId")' \
  "0"

# 5d. No OutboxEvents in delivered/dead_letter state referencing missing Publications
psql_check \
  "Dead-letter OutboxEvents referencing missing Publication" \
  'SELECT COUNT(*) FROM "OutboxEvent" oe WHERE oe.status = '"'"'dead_letter'"'"' AND (oe.payload->>'"'"'publicationId'"'"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Publication" p WHERE p.id = oe.payload->>'"'"'publicationId'"'"')' \
  "0"

###############################################################################
# Step 6: Report
###############################################################################
TOTAL_ELAPSED=$(( $(date +%s) - DRILL_START ))
echo ""
echo "========================================="
echo " DR DRILL RESULT — PostgreSQL Restore"
echo "========================================="
echo " Dump file size : $DUMP_SIZE"
echo " pg_dump time   : ${DUMP_ELAPSED}s"
echo " pg_restore time: ${RESTORE_ELAPSED}s"
echo " migrate time   : ${MIGRATE_ELAPSED}s"
echo " Total RTO      : ${TOTAL_ELAPSED}s"
echo " Checks passed  : $PASS"
echo " Checks failed  : $FAIL"
if [[ $FAIL -eq 0 ]]; then
  echo " STATUS         : PASS"
  echo "========================================="
  echo ""
  echo "Update DISASTER_RECOVERY.md 'Last drill' to: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
else
  echo " STATUS         : FAIL — $FAIL check(s) failed"
  echo "========================================="
  exit 1
fi

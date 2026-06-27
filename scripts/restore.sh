#!/usr/bin/env bash
# Nashrino — Restore script
# Restores a backup created by scripts/backup.sh
# Usage: ./scripts/restore.sh ./backups/nashrino-backup-YYYY-MM-DD-HHMMSS.tar.gz
# WARNING: Overwrites current PostgreSQL database. Stop the app first.
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file.tar.gz>"
  exit 1
fi

BACKUP_FILE="$1"
[ ! -f "$BACKUP_FILE" ] && echo "❌ Not found: $BACKUP_FILE" && exit 1

[ -f .env ] && source .env
[ -f .env.production ] && source .env.production

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "📦 Nashrino restore — $BACKUP_FILE"
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Database
DB_URL="${DIRECT_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ] || [[ "$DB_URL" != postgresql://* ]]; then
  echo "❌ DIRECT_DATABASE_URL or DATABASE_URL must be a PostgreSQL URL"
  exit 1
fi

SQL_FILE=$(find "$TEMP_DIR" -name "db-*.sql" | head -1)
if [ -n "$SQL_FILE" ]; then
  echo "   DB: PostgreSQL — ⚠️  OVERWRITES current database!"
  read -p "   Continue? (yes/no): " confirm
  [ "$confirm" != "yes" ] && echo "   ❌ Cancelled" && exit 0
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
  echo "   ✅ PostgreSQL restored"
fi

# Env
ENV_FILE=$(find "$TEMP_DIR" -name "env-*.enc" | head -1)
if [ -n "$ENV_FILE" ] && [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "   Env: decrypting..."
  openssl enc -aes-256-gcm -d -pbkdf2 \
    -in "$ENV_FILE" -out ".env.production.restored" \
    -pass env:BACKUP_ENCRYPTION_KEY
  echo "   ✅ Env restored to .env.production.restored (review + replace manually)"
fi

echo "🎉 Done! Restart: docker compose down && docker compose up -d"

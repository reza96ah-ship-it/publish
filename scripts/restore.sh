#!/usr/bin/env bash
# Nashrino — Restore script
# Restores a backup created by scripts/backup.sh
# Usage: ./scripts/restore.sh ./backups/nashrino-backup-YYYY-MM-DD-HHMMSS.tar.gz
# WARNING: Overwrites current database. Stop the app first.
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
if [ -n "${DATABASE_URL:-}" ] && [[ "${DATABASE_URL}" == postgresql://* ]]; then
  SQL_FILE=$(find "$TEMP_DIR" -name "db-*.sql" | head -1)
  if [ -n "$SQL_FILE" ]; then
    echo "   DB: PostgreSQL — ⚠️  OVERWRITES current database!"
    read -p "   Continue? (yes/no): " confirm
    [ "$confirm" != "yes" ] && echo "   ❌ Cancelled" && exit 0
    psql "$DATABASE_URL" --no-owner --no-privileges -f "$SQL_FILE"
    echo "   ✅ PostgreSQL restored"
  fi
else
  DB_FILE=$(find "$TEMP_DIR" -name "db-*.db" | head -1)
  if [ -n "$DB_FILE" ]; then
    echo "   DB: SQLite"
    mkdir -p db
    cp "$DB_FILE" "db/custom.db"
    echo "   ✅ SQLite restored to db/custom.db"
  fi
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

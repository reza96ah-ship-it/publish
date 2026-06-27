#!/usr/bin/env bash
# Nashrino — Backup script
# Backs up: SQLite DB (or PostgreSQL via pg_dump), .env.production (encrypted)
# Usage: ./scripts/backup.sh
#        BACKUP_ENCRYPTION_KEY=mykey S3_BUCKET=my-bucket ./scripts/backup.sh
set -euo pipefail

[ -f .env ] && source .env
[ -f .env.production ] && source .env.production

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y-%m-%d-%H%M%S")
BACKUP_FILE="$BACKUP_DIR/nashrino-backup-$TIMESTAMP.tar.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

echo "📦 Nashrino backup — $TIMESTAMP"
echo "   Output: $BACKUP_FILE"

# 1. Database
DB_BACKUP="$BACKUP_DIR/db-$TIMESTAMP"
if [ -n "${DATABASE_URL:-}" ] && [[ "${DATABASE_URL}" == postgresql://* ]]; then
  echo "   DB: PostgreSQL"
  pg_dump "$DATABASE_URL" --no-owner --no-privileges > "$DB_BACKUP.sql"
  DB_FILE="$DB_BACKUP.sql"
elif [ -f "db/custom.db" ]; then
  echo "   DB: SQLite (db/custom.db)"
  cp "db/custom.db" "$DB_BACKUP.db"
  DB_FILE="$DB_BACKUP.db"
else
  echo "   ⚠️  No database found — skipping"
  DB_FILE=""
fi

# 2. Env (encrypted)
ENV_FILE=""
if [ -f ".env.production" ] && [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "   Env: .env.production (encrypted)"
  ENV_FILE="$BACKUP_DIR/env-$TIMESTAMP.enc"
  openssl enc -aes-256-gcm -salt -pbkdf2 \
    -in ".env.production" -out "$ENV_FILE" \
    -pass env:BACKUP_ENCRYPTION_KEY
fi

# 3. Tarball
FILES=""
[ -n "$DB_FILE" ] && FILES="$FILES $DB_FILE"
[ -n "$ENV_FILE" ] && FILES="$FILES $ENV_FILE"

if [ -z "$FILES" ]; then
  echo "   ⚠️  Nothing to back up"
  exit 1
fi

tar -czf "$BACKUP_FILE" -C "$BACKUP_DIR" $(echo $FILES | xargs -n1 basename)
[ -n "$DB_FILE" ] && rm -f "$DB_FILE"
[ -n "$ENV_FILE" ] && rm -f "$ENV_FILE"
echo "   ✅ Backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# 4. S3 upload
if [ -n "${S3_BUCKET:-}" ] && command -v aws &> /dev/null; then
  echo "   ☁️  Uploading to s3://$S3_BUCKET/"
  aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/$(basename $BACKUP_FILE)" --storage-class STANDARD_IA
  echo "   ✅ Uploaded"
fi

# 5. Cleanup old
find "$BACKUP_DIR" -name "nashrino-backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete
echo "   🧹 Cleaned backups older than $RETENTION_DAYS days"
echo "🎉 Done!"

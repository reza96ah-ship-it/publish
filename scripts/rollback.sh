#!/usr/bin/env bash
# Nashrino — Rollback script
# Re-deploys a previous Docker image tag.
# Usage: ./scripts/rollback.sh              # interactive tag selection
#        ./scripts/rollback.sh v1.0.0       # specific tag
set -euo pipefail

[ ! -f .env.production ] && echo "❌ .env.production not found" && exit 1
source .env.production

COMPOSE_FILE="compose.production.yaml"

if [ $# -ge 1 ]; then
  TARGET_TAG="$1"
else
  echo "🔙 Usage: $0 <tag>"
  echo "   Example: $0 v1.0.0"
  echo "   List tags: docker images ghcr.io/reza96ah-ship-it/publish --format '{{.Tag}}'"
  exit 1
fi

echo "⚠️  Restarting all services with tag: $TARGET_TAG"
read -p "   Continue? (yes/no): " confirm
[ "$confirm" != "yes" ] && echo "   ❌ Cancelled" && exit 0

export IMAGE_TAG="$TARGET_TAG"
export IMAGE_TAG_WORKER="${TARGET_TAG}"
export IMAGE_TAG_REALTIME="${TARGET_TAG}"

echo "📦 Pulling images..."
docker compose -f "$COMPOSE_FILE" pull
echo "🔄 Restarting..."
docker compose -f "$COMPOSE_FILE" up -d
echo "⏳ Waiting for health (10s)..."
sleep 10

if docker compose -f "$COMPOSE_FILE" ps | grep -q "healthy"; then
  echo "✅ Rollback complete! Tag: $TARGET_TAG"
else
  echo "⚠️  Check health: docker compose -f $COMPOSE_FILE ps"
fi

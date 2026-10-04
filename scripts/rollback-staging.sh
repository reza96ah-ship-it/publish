#!/usr/bin/env bash
# Revert only the shared-host staging app/worker/realtime images. The host Caddy,
# Xray, webhook relay, database, and migration service are never targeted.
set -euo pipefail

usage() {
  echo "Usage: $0 staging-<reviewed-commit-sha>" >&2
}

if [ "${1:-}" = '--help' ]; then
  usage
  exit 0
fi

target_tag="${1:-}"
if [[ ! "$target_tag" =~ ^staging-[0-9a-f]{7,40}$ ]]; then
  usage
  exit 2
fi

cd "$(dirname "$0")/.."
if [ ! -f .env.production ] || [ ! -f compose.staging.yaml ]; then
  echo 'Staging environment or Compose overlay is missing; refusing rollback.' >&2
  exit 1
fi
if ! grep -Eq '^NEXTAUTH_URL="?https://staging\.odooshoping\.ir/?"?$' .env.production; then
  echo 'NEXTAUTH_URL is not the isolated staging domain; refusing rollback.' >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo 'curl is required for post-rollback health checks.' >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo 'python3 is required to validate the application health response.' >&2
  exit 1
fi

export COMPOSE_PROFILES=''
compose=(docker compose --env-file .env.production -p nashrino-staging -f compose.production.yaml -f compose.staging.yaml)
"${compose[@]}" config --quiet
if "${compose[@]}" config --services | grep -qx caddy; then
  echo 'The Compose Caddy service is active; refusing to touch ports 80/443.' >&2
  exit 1
fi

app_id="$("${compose[@]}" ps -q app)"
worker_id="$("${compose[@]}" ps -q worker)"
realtime_id="$("${compose[@]}" ps -q realtime)"
if [ -z "$app_id" ] || [ -z "$worker_id" ] || [ -z "$realtime_id" ]; then
  echo 'The staging stack is incomplete; refusing to use rollback as an initial deploy.' >&2
  exit 1
fi

old_app="$(docker inspect --format '{{.Config.Image}}' "$app_id")"
old_worker="$(docker inspect --format '{{.Config.Image}}' "$worker_id")"
old_realtime="$(docker inspect --format '{{.Config.Image}}' "$realtime_id")"
if [ -z "$old_app" ] || [ -z "$old_worker" ] || [ -z "$old_realtime" ]; then
  echo 'Could not identify all current staging images; refusing rollback.' >&2
  exit 1
fi

echo "Staging-only code rollback to $target_tag. Database migrations will NOT be reversed."
read -r -p 'Confirm the previous code is schema-compatible and type yes: ' confirmation
if [ "$confirmation" != 'yes' ]; then
  echo 'Cancelled.'
  exit 0
fi

export IMAGE_TAG="ghcr.io/reza96ah-ship-it/publish:$target_tag"
export IMAGE_TAG_WORKER="ghcr.io/reza96ah-ship-it/publish-worker:$target_tag"
export IMAGE_TAG_REALTIME="ghcr.io/reza96ah-ship-it/publish-realtime:$target_tag"
"${compose[@]}" pull app worker realtime

rollback_started=false
restore_previous_on_failure() {
  status=$?
  if [ "$rollback_started" = true ] && [ "$status" -ne 0 ]; then
    trap - EXIT
    set +e
    echo 'Staging rollback failed; attempting to restore previous images.' >&2
    export IMAGE_TAG="$old_app"
    export IMAGE_TAG_WORKER="$old_worker"
    export IMAGE_TAG_REALTIME="$old_realtime"
    "${compose[@]}" up -d --no-deps --force-recreate app worker realtime ||
      echo 'Automatic image restoration failed; manual staging intervention required.' >&2
  fi
}
trap restore_previous_on_failure EXIT
rollback_started=true
"${compose[@]}" up -d --no-deps --force-recreate app worker realtime

healthy=false
for _ in {1..12}; do
  worker_id="$("${compose[@]}" ps -q worker)"
  if curl -fsS --max-time 3 http://127.0.0.1:3004/api/health |
       python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("ok") else 1)' &&
     curl -fsS --max-time 3 http://127.0.0.1:3005/health >/dev/null &&
     [ -n "$worker_id" ] &&
     [ "$(docker inspect --format '{{.State.Health.Status}}' "$worker_id")" = healthy ]; then
    healthy=true
    break
  fi
  sleep 5
done

if [ "$healthy" != true ]; then
  echo 'Staging health failed after rollback.' >&2
  exit 1
fi

rollback_started=false
trap - EXIT
"${compose[@]}" ps
echo "Staging code rollback to $target_tag passed local health checks."

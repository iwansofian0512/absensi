#!/usr/bin/env bash
# Deploy one immutable image tag: pull -> migrate -> up -> smoke.
# On smoke failure, roll back the application image (never the schema).
set -euo pipefail

TAG="${1:-}"
if [ -z "$TAG" ]; then
	echo "usage: deploy.sh <image-tag>" >&2
	exit 2
fi

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
	echo "deploy/.env is missing (copy .env.example, chmod 600)" >&2
	exit 2
fi
set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${MIGRATE_DATABASE_URL:?set MIGRATE_DATABASE_URL in deploy/.env}"
COMPOSE=(docker compose -f compose.yml)
export IMAGE_TAG="$TAG"

CURRENT="$(cat .current_tag 2>/dev/null || true)"
echo "deploying ${TAG} (current: ${CURRENT:-none})"

"${COMPOSE[@]}" pull api web

# First deploy: Postgres must exist before the one-shot migration container.
"${COMPOSE[@]}" up -d --wait postgres

echo "running migrations as the owner role"
"${COMPOSE[@]}" run --rm --no-deps --entrypoint /app/migrate \
	-e DATABASE_URL="$MIGRATE_DATABASE_URL" api up

VERSION_OUTPUT="$("${COMPOSE[@]}" run --rm --no-deps --entrypoint /app/migrate \
	-e DATABASE_URL="$MIGRATE_DATABASE_URL" api version)"
echo "$VERSION_OUTPUT"
if printf '%s\n' "$VERSION_OUTPUT" | grep -q 'dirty: true'; then
	echo "migration state is dirty; fix and force explicitly before redeploying" >&2
	exit 1
fi

"${COMPOSE[@]}" up -d --no-deps api web caddy

if ./scripts/smoke.sh; then
	if [ -n "$CURRENT" ]; then
		printf '%s\n' "$CURRENT" > .previous_tag
	fi
	printf '%s\n' "$TAG" > .current_tag
	echo "deploy ok: ${TAG}"
else
	echo "smoke failed; rolling back to ${CURRENT:-<none>}" >&2
	./scripts/rollback.sh
	exit 1
fi

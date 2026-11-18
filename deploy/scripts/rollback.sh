#!/usr/bin/env bash
# Application rollback only. Schema rollback is forward-fix, not `migrate down`
# (see docs/plan/07-db-migration.md §9).
set -euo pipefail

cd "$(dirname "$0")/.."

TAG="${1:-}"
if [ -z "$TAG" ]; then
	TAG="$(cat .previous_tag 2>/dev/null || true)"
fi
if [ -z "$TAG" ]; then
	echo "no previous tag recorded; pass one explicitly: rollback.sh <image-tag>" >&2
	exit 2
fi

if [ ! -f .env ]; then
	echo "deploy/.env is missing" >&2
	exit 2
fi
set -a
# shellcheck disable=SC1091
. ./.env
set +a

export IMAGE_TAG="$TAG"
echo "rolling back application to ${TAG}"
docker compose -f compose.yml up -d --no-deps api web caddy
./scripts/smoke.sh
printf '%s\n' "$TAG" > .current_tag
echo "rollback ok: ${TAG}"

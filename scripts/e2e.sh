#!/usr/bin/env bash
# End-to-end gate: real Postgres (compose) + API + Vite preview + Playwright.
# Requires Docker, Go, pnpm, curl, and a Chromium Playwright browser:
#   pnpm --dir web exec playwright install chromium
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
	set -a
	# shellcheck disable=SC1091
	. ./.env.local
	set +a
fi

export DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/absensi?sslmode=disable}"

docker compose -f docker-compose.dev.yml up -d --wait
go run ./cmd/migrate up

mkdir -p .cache/bin
go build -o .cache/bin/api ./cmd/api
.cache/bin/api >.cache/api-e2e.log 2>&1 &
API_PID=$!

cleanup() {
	kill "$API_PID" 2>/dev/null || true
	wait "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT

ready=0
for _ in $(seq 1 60); do
	if curl -fsS http://127.0.0.1:8080/health >/dev/null 2>&1; then
		ready=1
		break
	fi
	sleep 1
done
if [ "$ready" -ne 1 ]; then
	echo "e2e failed: API did not become healthy; see .cache/api-e2e.log" >&2
	exit 1
fi

pnpm --dir web build
pnpm --dir web exec playwright test "$@"

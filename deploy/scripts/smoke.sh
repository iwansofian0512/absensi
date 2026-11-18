#!/usr/bin/env bash
# Post-deploy smoke. Bootstrap slice covers health + SPA availability.
# Login and attendance-scan smoke steps are added with S0/S3; do not fake them.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
	set -a
	# shellcheck disable=SC1091
	. ./.env
	set +a
fi

BASE="${SMOKE_URL:-https://${DOMAIN:?set SMOKE_URL or DOMAIN}}"
echo "smoke: ${BASE}"

ready=0
for _ in $(seq 1 30); do
	if curl -fsS --max-time 5 "$BASE/health" >/dev/null 2>&1; then
		ready=1
		break
	fi
	sleep 1
done
if [ "$ready" -ne 1 ]; then
	echo "smoke failed: ${BASE}/health never became ready" >&2
	exit 1
fi

curl -fsS --max-time 10 "$BASE/health" | grep -q '"status":"ok"'

code="$(curl -fsS --max-time 10 -o /dev/null -w '%{http_code}' "$BASE/")"
if [ "$code" != "200" ]; then
	echo "smoke failed: GET / returned ${code}" >&2
	exit 1
fi

echo "smoke ok"

#!/usr/bin/env bash
# Daily logical backup: pg_dump -Fc, verify the archive, prune, optional rclone.
# Runs both inside the compose backup container and on a host with PG* env set.
set -euo pipefail

: "${PGHOST:?PGHOST is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGDATABASE:?PGDATABASE is required}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
FILE="${DIR}/absensi-${STAMP}.dump"

mkdir -p "$DIR"
pg_dump -Fc -f "$FILE"

# Cheap integrity check: a truncated dump fails pg_restore --list.
pg_restore --list "$FILE" >/dev/null

find "$DIR" -type f -name 'absensi-*.dump' -mtime +"$RETENTION_DAYS" -delete

if command -v rclone >/dev/null 2>&1 && [ -n "${RCLONE_REMOTE:-}" ]; then
	rclone copy "$FILE" "$RCLONE_REMOTE"
	echo "uploaded to ${RCLONE_REMOTE}"
else
	echo "offsite upload skipped: install rclone and set RCLONE_REMOTE"
fi

echo "backup ok: ${FILE}"

#!/bin/sh
# Runs once on an empty Postgres data volume (docker-entrypoint-initdb.d).
# Provisions the least-privilege application role; schema DDL stays with the
# owner role used by cmd/migrate. Not a migration.
set -eu

if [ -z "${ABSENSI_APP_PASSWORD:-}" ]; then
	echo "ABSENSI_APP_PASSWORD is required" >&2
	exit 1
fi

psql -v ON_ERROR_STOP=1 \
	--username "$POSTGRES_USER" \
	--dbname "$POSTGRES_DB" \
	-v app_password="$ABSENSI_APP_PASSWORD" \
	-v dbname="$POSTGRES_DB" \
	-v owner="$POSTGRES_USER" <<'EOSQL'
CREATE ROLE absensi_app LOGIN PASSWORD :'app_password';

GRANT CONNECT ON DATABASE :"dbname" TO absensi_app;
GRANT USAGE ON SCHEMA public TO absensi_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO absensi_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO absensi_app;

ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO absensi_app;
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
	GRANT USAGE, SELECT ON SEQUENCES TO absensi_app;
EOSQL

echo "provisioned role absensi_app"

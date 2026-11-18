SHELL := /bin/bash

CONTEXT_BASE ?= origin/main
DATABASE_URL ?= postgres://postgres:postgres@localhost:5432/absensi?sslmode=disable
COMPOSE_DEV := docker compose -f docker-compose.dev.yml
COMPOSE_DEPLOY := docker compose -f deploy/compose.yml
SQLC_VERSION := 1.28.0
PNPM ?= pnpm
N ?= 1

export DATABASE_URL

# Accept the positional form used in the runbook: `make migrate-down 1`.
# The numeric goal is a no-op target so make does not fail with "No rule".
ifeq ($(firstword $(MAKECMDGOALS)),migrate-down)
  N := $(or $(wordlist 2,2,$(MAKECMDGOALS)),1)
  $(eval $(N):;@:)
endif
ifeq ($(firstword $(MAKECMDGOALS)),migrate-force)
  N := $(wordlist 2,2,$(MAKECMDGOALS))
  ifneq ($(N),)
    $(eval $(N):;@:)
  endif
endif

.PHONY: dev install build test e2e verify verify-full \
	db-up db-down db-shell db-reset \
	migrate-up migrate-down migrate-version migrate-force sqlc db-generate db-migrate \
	contract-check deploy \
	context context-check env-check context-generated-check context-external context-external-check

# --- aplikasi -------------------------------------------------------------
dev:
	go run ./cmd/api

install:
	$(PNPM) --dir web install --frozen-lockfile

build:
	go build ./...
	$(PNPM) --dir web build

test:
	go test ./...
	$(PNPM) --dir web exec vitest run

e2e:
	./scripts/e2e.sh

# --- database -------------------------------------------------------------
db-up:
	$(COMPOSE_DEV) up -d --wait

db-down:
	$(COMPOSE_DEV) down

db-shell:
	$(COMPOSE_DEV) exec postgres psql -U postgres -d absensi

db-reset:
	$(COMPOSE_DEV) down -v
	$(COMPOSE_DEV) up -d --wait
	$(MAKE) migrate-up

migrate-up:
	go run ./cmd/migrate up

migrate-down:
	go run ./cmd/migrate down $(N)

migrate-version:
	go run ./cmd/migrate version

migrate-force:
	@test -n "$(N)" || { echo "usage: make migrate-force <version>"; exit 2; }
	go run ./cmd/migrate force $(N)

# sqlc's native install breaks on macOS (pg_query/strchrnul); the pinned image
# keeps output identical locally and in CI.
sqlc:
	docker run --rm -v "$(CURDIR):/src" -w /src sqlc/sqlc:$(SQLC_VERSION) generate -f db/sqlc.yaml

# Compat aliases for the context-kit default commands.
db-generate: sqlc
db-migrate: migrate-up

# --- contract & deploy ----------------------------------------------------
contract-check:
	$(PNPM) --dir web contract:types
	git diff --exit-code -- web/src/lib/api

deploy:
	./deploy/scripts/deploy.sh $(TAG)

# --- context gates --------------------------------------------------------
# Dokumen wajib dibaca + context-pack.md untuk sesi agent.
context:
	node scripts/context/router.mjs --base $(CONTEXT_BASE) --pack context-pack.md

# Gate: lapisan arti berubah tanpa update dokumen artinya.
context-check:
	node scripts/context/router.mjs --strict --base $(CONTEXT_BASE)

# Gate: env dipakai kode tanpa tercatat di .env.example (sekaligus regenerate katalog).
env-check:
	node scripts/context/env-check.mjs --md docs/generated/env.md

# Baca context repo lain (read-only) sesuai docs/external.json → external-context.md.
context-external:
	node scripts/context/external.mjs --pack external-context.md $(if $(REPO),--repo $(REPO),)

# Gate: path/file repo lain yang ditunjuk harus ada (deteksi repo dipindah/dihapus).
context-external-check:
	node scripts/context/external.mjs --check

# Gate: katalog generated tidak boleh basi.
context-generated-check:
	@test -z "$$(git status --porcelain -- docs/generated/)" || { echo "docs/generated/ basi — generate lalu commit"; exit 1; }

# Static + unit + build. E2E is a separate gate because it needs Docker and a
# Playwright browser; `make verify-full` runs both.
verify: env-check context-check context-external-check
	go vet ./...
	go test ./...
	$(PNPM) --dir web exec tsc --noEmit
	$(PNPM) --dir web exec eslint . --max-warnings=0
	$(PNPM) --dir web exec vitest run
	$(PNPM) --dir web build

verify-full: verify e2e

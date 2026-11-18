# absensi

Absensi sekolah harian: data siswa, kartu QR statis, scan masuk/pulang, rekap.

**Status sesi ini: bootstrap repo + tooling + pipeline.** Belum ada fitur bisnis — tidak ada auth,
CRUD siswa, absensi, scan, atau laporan. Keputusan mengikat ada di [`docs/plan/00-discovery.md`](docs/plan/00-discovery.md)
(K1–K6); dokumen `docs/plan/` disalin verbatim dari sesi discovery.

## Stack

Go 1.24 (chi, pgx/v5, golang-migrate, sqlc, log/slog) · PostgreSQL 17 ·
React 19 + Vite + TypeScript + TanStack Query · pnpm · Docker Compose + Caddy di VPS.
**Tanpa API gateway**; Caddy hanya TLS/header/body limit/reverse proxy/static SPA.

## Mulai

```bash
cp .env.example .env.local      # isi DATABASE_URL (dev default sudah ada)
make db-up                      # Postgres 17 via docker compose
make migrate-up                 # skema terbaru
make dev                        # API :8080; GET /health
pnpm --dir web install
pnpm --dir web dev              # SPA :5173 (proxy /health, /api)
```

`pnpm` bisa lewat corepack: `corepack enable` (butuh tulis ke cache pengguna) atau
`corepack pnpm ...`.

## Struktur

```
cmd/api            server + graceful shutdown
cmd/migrate        up / down N / version / force (migrasi embedded)
api/               router + handler tipis
db/                embed.go, migrations, queries, sqlc.yaml
internal/platform/ config, logger, db pool, http server
internal/store/    generated sqlc (jangan diedit)
web/               Vite + React + TS (satu halaman "ok")
openapi/           kontrak API → tipe FE generated
deploy/            Dockerfile, compose, Caddyfile, script deploy
docs/plan/         keputusan K1–K6 (verbatim, jangan diedit)
```

## Gate

```bash
make verify        # env/context, go vet+test, tsc, eslint, vitest, build
make e2e           # compose + API + Playwright (butuh Docker & chromium)
make context-check
make env-check
make sqlc          # regenerate internal/store
```

CI: `.github/workflows/ci.yml` (secret, go, db, contract, web, e2e, context);
deploy: `.github/workflows/deploy.yml` (GHCR → VPS → migrate → up → smoke).
Lihat `docs/plan/07-db-migration.md` dan `docs/plan/09-cicd-gateway.md` untuk aturan lengkap.

## Deploy (ringkas)

VPS menyimpan `deploy/.env` (mode 600) dan repo ini di `/srv/absensi`.
`deploy/scripts/deploy.sh <sha>` menarik image GHCR, menjalankan migrasi sebagai
`absensi_owner`, menaikkan `api`/`web`/`caddy`, lalu smoke; gagal smoke → rollback image.
Restore backup dan restore drill belum diuji (S5).

## Jangan

- Menambah gateway (Kong/Traefik/APISIX) atau rate limit plugin Caddy.
- Membuat tabel `users`/`students`/`attendance` di luar slice S0/S1.
- Mengedit `docs/plan/` atau `internal/store/`.

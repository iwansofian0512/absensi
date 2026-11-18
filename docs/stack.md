# Stack — absensi

> **Dideklarasikan 2026-11-18.** Ini sumber kebenaran stack. Kalau berubah, ubah file ini
> lalu sesuaikan bagian Stack di `AGENTS.md` dan perintah di `Makefile`.

Go 1.26 (chi, pgx/v5, golang-migrate, sqlc, log/slog) · PostgreSQL 17 · React 19 + Vite + TypeScript ·
TanStack Query · pnpm · VPS (Docker Compose + Caddy)

| Aspek | Nilai |
|---|---|
| Bahasa | Go 1.26 + TypeScript |
| Framework | Go HTTP API (chi) + React (Vite) |
| Database | PostgreSQL 17 (pgx/v5, sqlc) |
| Migrasi | golang-migrate, file embedded, job terpisah |
| Hosting | VPS (Docker Compose + Caddy) |
| Package manager | go + pnpm |

## Rencana & keputusan

Sumber keputusan sesi bootstrap ada di `docs/plan/` dan **disalin verbatim** — jangan diedit,
diringkas, atau "diperbaiki" dari repo ini. Mulai dari:

- [`docs/plan/00-discovery.md`](plan/00-discovery.md) — keputusan mengikat **K1–K6**, scope MVP,
  arsitektur, slice S0–S5, risiko.
- [`docs/plan/01-rbac-matrix.md`](plan/01-rbac-matrix.md) — role & matriks izin.
- [`docs/plan/02-qr-attendance.md`](plan/02-qr-attendance.md) — QR statis.
- [`docs/plan/03-daily-attendance.md`](plan/03-daily-attendance.md) — aturan waktu/status.
- [`docs/plan/04-fraud-controls.md`](plan/04-fraud-controls.md) — koreksi & audit.
- [`docs/plan/05-ops-vps.md`](plan/05-ops-vps.md) — topologi VPS.
- [`docs/plan/06-layout.md`](plan/06-layout.md) — layout repo.
- [`docs/plan/07-db-migration.md`](plan/07-db-migration.md) — alur migrasi & role DB.
- [`docs/plan/09-cicd-gateway.md`](plan/09-cicd-gateway.md) — CI/CD & keputusan **tanpa API gateway**.

Ringkas keputusan: harian + jam masuk/pulang (K1), akun siswa read-only (K2), QR statis (K3),
satu sekolah (K4), koreksi terbatas & teraudit (K5), deploy VPS (K6). Caddy hanya edge
(TLS/header/body limit/proxy/static SPA); authz, rate limit, dan audit tetap di aplikasi.

## Perintah

| Tujuan | Perintah |
|---|---|
| Jalanin app | `make dev` |
| Semua gate statis + unit | `make verify` |
| Unit/integration | `make test` |
| E2E (compose + Playwright) | `make e2e` |
| Postgres lokal | `make db-up` / `make db-down` / `make db-shell` |
| Migrasi | `make migrate-up` · `make migrate-down 1` · `make migrate-version` |
| sqlc | `make sqlc` |
| Build | `make build` |
| Deploy | `make deploy TAG=<sha>` |
| Context pack | `make context` |

## Konsekuensi & catatan

- Handler tipis: parse → validasi → service → response. Tanpa logika bisnis di handler.
- Error di-wrap (`fmt.Errorf("...: %w", err)`), dipetakan ke status HTTP di satu tempat.
- Query SQL generated oleh sqlc di `internal/store`; tidak ada SQL di handler/service.
- Kontrak API: `openapi/openapi.yaml`; tipe FE generated ke `web/src/lib/api/schema.d.ts`.
- Env dibaca sekali di `internal/platform/config` dan divalidasi saat start.
- Migrasi di-embed di `db/embed.go`; `cmd/migrate` adalah proses terpisah dari API.
- `internal/platform/**` adalah infrastruktur (config/logger/db/http), bukan domain.

## Yang sengaja tidak dipakai

- **API gateway** (Kong/Traefik/APISIX): tidak ada backend kedua, authz butuh konteks baris,
  rate limit butuh identitas. Caddy cukup untuk edge. Trigger untuk berubah ada di 09 §9.
- ORM / auto-migrate saat boot; schema berubah hanya lewat `cmd/migrate`.
- JWT di `localStorage`; sesi memakai cookie httpOnly (S0).
- Microservices, Kubernetes, GraphQL; satu monorepo, REST + OpenAPI.
- `shadcn/ui` belum dipasang; komponen UI dibuat saat slice membutuhkannya.

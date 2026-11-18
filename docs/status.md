# STATUS

> Memori kerja antar sesi. Maks 30 baris.

## Sekarang
- Bootstrap repo + tooling + pipeline selesai di `main`; **belum ada fitur bisnis**.
- Backend: `/health`, graceful shutdown, embedded migration (hanya `citext`), sqlc config.
- Frontend: satu halaman "ok"; OpenAPI → tipe FE generated; Playwright journey.
- Infra: compose dev Postgres 17, CI 7 job, deploy GHCR → VPS, Caddy edge (tanpa gateway).
- Terverifikasi: build/vet/test-race, migrate replay, sqlc diff, e2e, compose config, gosec,
  govulncheck, Caddy validate, image api+web berjalan.
## Berikutnya (urut)
1. **S0** auth staf: Argon2id, cookie session (idle 30m/absolute 8h), CSRF, rate limit,
   audit skeleton, RBAC `can()`, seed superadmin, migrasi `000002_users_sessions`.
2. Migrasi 000006: grant audit INSERT-only + trigger append-only untuk `absensi_app`.
3. Tulis `docs/specs/001-auth-rbac.md` sebelum handler auth; test negatif RBAC wajib.
4. S1 siswa/kelas/QR → S3 scan → S4 koreksi/laporan → S5 hardening + restore drill.
## Dikenal bermasalah
- `make verify` tidak menjalankan e2e (butuh Docker + Chromium); `make e2e`/CI tetap gate.
- Smoke deploy baru `/health` + SPA; login/scan menyusul di S0/S3.
- Init role DB hanya jalan pada volume kosong; restore backup belum diuji (S5).

## Jebakan yang sudah memakan waktu
- Sandbox: cache Go/npm user tidak writable → `GOPATH=.cache/gopath`, `GOCACHE=.cache/go-build`,
  `GOTOOLCHAIN=go1.26.11`; `pnpm` lewat corepack/`.tools/pnpm`.
- sqlc 1.28.0 menolak `queries/` kosong; `health.sql` hanya `SELECT 1` (bukan bisnis).
- `CREATE INDEX CONCURRENTLY` satu statement per file; gagal → `dirty`, perbaiki lalu `force`.
- go.mod butuh Go 1.26 (pgx 5.9.2 + stdlib govulncheck); CI/image di-pin 1.26.11.
## Keputusan yang menunggu
- Setujui dev-dependency `openapi-typescript` + ping query sqlc; setujui Go 1.26 sebagai stack final.

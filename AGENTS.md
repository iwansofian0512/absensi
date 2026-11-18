# AGENTS.md — absensi

Go 1.26 (chi, pgx/v5, golang-migrate, sqlc, log/slog) · PostgreSQL 17 · React 19 + Vite + TypeScript · TanStack Query · Playwright

> **Stack dideklarasikan** di `docs/stack.md` (2026-11-18). Kalau stack berubah, ubah di sana
> lalu sesuaikan bagian Stack di file ini. Jangan biarkan keduanya berbeda.
> Baca juga: `docs/status.md` (keadaan terakhir) · `docs/architecture.md` (alur & tabel).

## Non-negotiable

1. **Spec dulu.** Perubahan perilaku butuh `docs/specs/<slug>.md`. Tidak ada spec → tanya.
2. **Bukti, bukan klaim.** "Selesai" = `make verify` hijau + output ditempel.
3. **Satu vertical slice per PR.** Tanpa refactor/rename campuran.
4. **Dependency/abstraksi baru butuh ADR** di `docs/decisions/`.
5. **Reuse dulu.** Cek komponen/util yang ada sebelum membuat baru.
6. **Validasi & otorisasi di server**, per resource. Identitas dari session, bukan body/query.
7. **Jangan sentuh yang tidak diminta.**
8. **Design ikut token** (`docs/design/tokens.md`): tanpa hex/px acak, font baru, gradient dekoratif.
9. **Uang integer unit minor · waktu UTC di DB · tampilan `Asia/Jakarta`.**
10. **Secret tidak masuk repo/log.** Env divalidasi saat boot; `make env-check` wajib hijau.
11. **Migrasi forward-only**, expand → migrate → contract. Destruktif butuh backup + rollback.
12. **Test untuk aturan bisnis, E2E untuk journey.**
13. **Tanpa API gateway.** Caddy hanya TLS/header/body limit/proxy/static SPA; authz, rate limit,
    audit, idempotensi di aplikasi (`docs/plan/09-cicd-gateway.md`).

## Stack

| Aspek | Nilai |
|---|---|
| Bahasa | Go 1.26 + TypeScript |
| Framework | Go HTTP API (chi) + React (Vite) |
| Database | PostgreSQL 17 |
| Hosting | VPS (Docker Compose + Caddy) |
| Package manager | go + pnpm |

- **Lapisan:** `handler → service → store`; service tidak impor `net/http`.
- **Context** di-thread ke semua I/O (`ctx context.Context`), tanpa `context.Background()` di service.
- **Uang** pakai integer minor (`int64`) + currency; jangan `float64`.
- **Migrasi** forward-only di `db/migrations`, di-embed di `db/embed.go`, dijalankan `cmd/migrate`.
- **SQL** lewat sqlc → `internal/store` (generated, jangan diedit); tanpa SQL di handler/service.
- **CORS** eksplisit; cookie `httpOnly`; JWT tidak disimpan di `localStorage`.
- **Tanpa API gateway**; Caddy tidak menegakkan authz/rate limit. Jangan tambah Kong/Traefik/APISIX.

## Perintah

| Tujuan | Perintah |
|---|---|
| Jalanin app | `make dev` |
| Semua gate statis + unit | `make verify` |
| Unit/integration | `make test` |
| E2E | `make e2e` |
| Postgres lokal | `make db-up` / `make db-down` / `make db-shell` |
| Migrasi DB | `make migrate-up` · `make migrate-down 1` · `make migrate-version` |
| sqlc | `make sqlc` |
| Build | `make build` |
| Deploy | `make deploy TAG=<sha>` |
| Context pack | `make context` |

## Peta path → aturan (dibaca otomatis lewat `make context`)

| Kalau menyentuh… | Baca |
|---|---|
| ``web/src/**`, `web/src/features/*/ui/**`` | `docs/guidelines/10-frontend-ui.md` + `docs/design/tokens.md` |
| ``internal/**`, `api/**`, `db/**`, `web/src/features/*/api.ts`` | `docs/guidelines/20-data-api.md` |
| `**/*.test.*`, `e2e/**`, `*_test.go` | `docs/guidelines/30-testing.md` |
| auth, upload, payment, webhook, admin | `docs/guidelines/40-security.md` |
| `.github/**`, `Makefile`, `.env*`, migrasi | `docs/guidelines/50-deploy-ops.md` |
| uang / stok / hak akses | `docs/invariants/<domain>.md` (pelanggaran = blocker) |
| kontrak yang dipakai repo lain | `docs/consumers.md` (wajib diperbarui saat kontrak berubah) |

## Repo lain & kontrak

- **Context tinggal di repo masing-masing.** Repo ini tidak menyalin dokumen repo lain.
  Kalau perlu context repo lain: `make context-external REPO=<nama>` (baca dari `docs/external.json`,
  read-only). Jangan mengedit repo lain dari sesi ini — buka sesi di repo itu.
- **Kontrak keluar** (API/proto/schema/event yang dipakai repo lain) didokumentasikan di
  `docs/consumers.md`. Mengubah kontrak = perbarui file itu + naikkan versi, bukan edit diam-diam.
- Saat mengubah perilaku yang menyentuh kontrak: cek `docs/external.json` — repo mana yang terdampak,
  dan invariant consumer mana yang harus tetap benar.

## Protokol context

1. Awal sesi: `docs/status.md` → `docs/stack.md` → `make context`.
2. Sebelum mengubah lapisan arti (`service`, `actions`, `app/**`, `server/**`): baca `context-pack.md`.
3. Kalau arti berubah: perbarui `README.md` fitur / `docs/invariants/` **di PR yang sama**.
   Refactor murni: `--allow-drift` (tercatat) — jangan dijadikan kebiasaan.
4. Akhir sesi: perbarui `docs/status.md` (sekarang / berikutnya / jebakan) dan commit dengan alasan.

## Definition of Done

- [ ] Spec/invariant diperbarui kalau perilaku berubah
- [ ] `make verify` hijau (output ditempel)
- [ ] Screenshot 390/768/1440 untuk perubahan UI
- [ ] State loading/empty/error/unauthorized benar
- [ ] Preview deploy dicek, bukan diasumsikan
- [ ] Tanpa `console.log`, TODO tanpa tiket, mock di jalur produksi
- [ ] Rollback diketahui

## Saat ragu

Berhenti. Tulis 2 opsi + tradeoff + rekomendasi, lalu tanya. Jangan memilih diam-diam.

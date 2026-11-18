# Untuk repo lain (consumer entry point)

> **Kalau kamu agent yang bekerja di repo LAIN dan perlu context repo ini, baca file ini dulu.**
> File ini adalah antarmuka yang stabil. Jangan menebak dari nama fungsi atau dari repo lain.
> Pasangannya: `AGENTS.md` (aturan internal) — consumer tidak wajib membaca seluruh repo.

## Apa yang repo ini miliki (dan tidak)

- Memiliki: kontrak HTTP absensi sekolah (OpenAPI), stack Go + React, migrasi DB, gate CI/CD.
- Tidak memiliki: API publik versi stabil, SDK, event, atau multi-tenancy. Saat ini hanya
  bootstrap: `GET /health`. Endpoint bisnis menyusul di S0–S5 dan akan additive.

## Kontrak yang dipublikasikan

| Kontrak | Lokasi | Versi/kebijakan |
|---|---|---|
| HTTP API | `openapi/openapi.yaml` | v0.1.0, additive; `/health` stabil |
| Schema DB | `db/migrations/*.up.sql` | internal, bukan kontrak consumer |

## Invariant yang tidak boleh dilanggar consumer

- `INV-bootstrap-01` — `/health` mengembalikan `200 {"status":"ok"}` tanpa auth (dijaga
  `api/health/handler_test.go`).
- Tidak ada endpoint yang menerima `role`/`student_id` dari client (S0+, lihat
  `docs/plan/01-rbac-matrix.md`).

## Cara verifikasi minimum (kalau kamu mengubah sesuatu yang menyentuh repo ini)

```bash
make verify
make e2e          # butuh Docker + Playwright chromium
```

## Kebijakan perubahan

- Perubahan yang memutus consumer **wajib** versi baru + catatan di tabel kontrak + kabar ke consumer.
- Field/endpoint baru: additive dulu, hapus setelah consumer lama tidak dipakai.
- Jangan mengandalkan perilaku yang tidak tertulis di sini.

## Cara membaca context repo ini dari repo lain

Dari repo consumer: `make context-external REPO=absensi` (membaca `AGENTS.md` +
`docs/consumers.md` repo ini, read-only). Perubahan kode tetap dilakukan di sesi repo ini.

## Owner

iwansofian0512 · repo `github.com/iwansofian0512/absensi`

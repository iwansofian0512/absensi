# Arsitektur — absensi

> Satu halaman. Fakta (route, kolom, signature) diambil dari kode; di sini hanya alur dan batas.
> Status slice: **bootstrap** — belum ada fitur bisnis.

## Alur utama

```
Browser staf/siswa (React + Vite)
        │ HTTPS, cookie sesi (S0)
        ▼
   Caddy (TLS, header, body limit, reverse proxy, static SPA)
        ├── /            → web:8080 (static SPA)
        └── /api/*,/health → api:8080 (Go/chi)
                              │
                              ├── PostgreSQL 17 (pgx/v5, sqlc)
                              └── audit (S0+)
```

- Satu VPS, satu compose: `caddy`, `api`, `web`, `postgres`, `backup`.
- **Tanpa API gateway.** Authz per resource, rate limit, validasi, audit, dan idempotensi
  ada di aplikasi (lihat `docs/plan/09-cicd-gateway.md`).
- `cmd/migrate` adalah proses terpisah; API tidak pernah mengubah skema saat start.

## Tabel inti

Saat ini hanya ada `schema_migrations` (dikelola golang-migrate) dan ekstensi `citext`.
**Tidak ada tabel bisnis** — `users`, `students`, `attendance`, dan tabel lain adalah slice S0+.

| Tabel | Pemilik (fitur) | Catatan |
|---|---|---|
| `schema_migrations` | `cmd/migrate` | versi + dirty flag |
| `users`, `sessions` | S0 | belum dibuat |
| `classes`, `students` | S1 | belum dibuat |
| `attendance_days`, `attendance_edits` | S3/S4 | belum dibuat |

## Batas modul

- `api/*` → service/domain; tidak mengimpor `internal/store` langsung atau SQL.
- `internal/<domain>` → `platform`, `audit`, `rbac` lewat interface; bukan `net/http`.
- `internal/store` → generated sqlc saja, tanpa logika bisnis.
- `cmd/*` → wiring; tanpa logika domain.
- `internal/platform/**` → config, logger, db pool, HTTP server; tanpa arti domain.

## Efek eksternal

Belum ada payment/email/webhook. Backup harian `pg_dump` ada di `deploy/scripts/backup.sh`;
restore drill belum dilakukan (S5).

# Database Migration Flow — PostgreSQL (backend Go)

> Keputusan: **golang-migrate** dengan file pasangan `*.up.sql` / `*.down.sql`, di-embed ke binary,
> dijalankan oleh `cmd/migrate` (tanpa CLI eksternal di VPS). Skema adalah sumber kebenaran;
> **sqlc** membaca `*.up.sql`. Tidak ada ORM, tidak ada auto-migrate saat app start.

---

## 1. Kenapa golang-migrate (bukan goose/atlas/dbmate)

| Tool | Kelebihan | Kenapa tidak dipilih |
|---|---|---|
| **golang-migrate** | File up/down terpisah, embed (`iofs`), advisory lock, CLI + library, sqlc mudah mem-parse `*.up.sql` | Format dua file, bukan satu |
| goose | Satu file + anotasi, statement block | sqlc harus mem-parse file yang berisi Up *dan* Down |
| atlas | Lint perubahan destruktif, deklaratif | Toolchain tambahan; bagus untuk tim, berlebihan untuk solo |
| dbmate | Sederhana | Kurang matang untuk embed + Go API |

Aturan keras yang mengikuti pilihan ini:

1. **Tidak ada `AutoMigrate` saat boot.** App start tidak pernah mengubah skema.
2. **Migrasi dijalankan job terpisah** sebelum app versi baru menerima trafik.
3. **`*.down.sql` untuk dev/test**, bukan strategi rollback produksi (lihat §9).
4. **Setiap migrasi di-review seperti kode** — terutama yang menyentuh tabel besar.

---

## 2. Struktur file

```
db/
├── embed.go                      # //go:embed migrations/*.sql
├── migrations/
│   ├── 000001_init_extensions.up.sql
│   ├── 000001_init_extensions.down.sql
│   ├── 000002_users_sessions.up.sql
│   ├── 000002_users_sessions.down.sql
│   ├── 000003_classes_students.up.sql
│   ├── 000004_school_settings_days.up.sql
│   ├── 000005_attendance_days.up.sql
│   ├── 000006_attendance_edits_audit.up.sql
│   └── ...
├── queries/
│   ├── users.sql
│   ├── students.sql
│   └── attendance.sql
└── sqlc.yaml
```

- Nomor **6 digit urut**, bukan timestamp: `000007_add_exports.up.sql`. Alasan: mudah dibaca,
  urutan jelas di `ls`, tidak bentrok antar branch (kalau bentrok, renumber sebelum merge).
- Satu migrasi = satu tujuan. Jangan gabung "buat tabel + backfill + ubah kolom".
- File `down` wajib ada, walau produksi memakai forward-fix. Tanpa down, `make db-reset` dan
  test replay tidak bisa jalan.

---

## 3. Konfigurasi sqlc

```yaml
# db/sqlc.yaml — path relatif terhadap LOKASI FILE INI (bukan root repo)
version: "2"
sql:
  - engine: "postgresql"
    schema: "migrations"        # sqlc otomatis melewati *.down.sql
    queries: "queries"
    gen:
      go:
        package: "store"
        out: "../internal/store"
        sql_package: "pgx/v5"
        emit_json_tags: false
        emit_prepared_queries: false
```

- `schema` menunjuk direktori migrasi; **sqlc 1.28.0 terbukti melewati `*.down.sql`** (diuji),
  jadi `schema: "migrations"` cukup. Kalau versi sqlc berubah, uji ulang.
- Path di `sqlc.yaml` relatif terhadap direktori file config itu, bukan root repo. Ini penyebab
  error `stat .../db/db/migrations` yang paling sering.
- **Jangan edit `internal/store`** — generated. Context gate sudah mengabaikannya (`ignoreGlobs`).
- `sqlc generate` dijalankan setelah migrasi baru; CI gagal kalau hasilnya berbeda dari commit.
- Versi sqlc di-pin (mis. `go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.28.0 generate`) supaya
  output tidak berubah antar mesin.

Catatan yang terbukti saat spike:

- sqlc bisa mem-parse `CREATE FUNCTION ... $$`, `CREATE INDEX CONCURRENTLY`, dan `CREATE EXTENSION`.
- **`CREATE INDEX CONCURRENTLY` harus jadi satu-satunya statement di file migrasinya.** Kalau
  digabung dengan statement lain, Postgres menolak: *"cannot run inside a transaction block"*.
- Untuk tabel kecil (≤100k baris), `CREATE INDEX` biasa tidak masalah; `CONCURRENTLY` hanya untuk
  tabel besar, di file terpisah.

---

## 4. `cmd/migrate` — satu binary, tanpa CLI di server

```bash
go run ./cmd/migrate up            # jalankan semua yang belum
go run ./cmd/migrate down 1        # rollback 1 (dev)
go run ./cmd/migrate version       # versi + dirty?
go run ./cmd/migrate goto 5        # maju/mundur ke versi tertentu (dev)
go run ./cmd/migrate force 6       # HANYA setelah memperbaiki manual
# catatan: versi = angka prefix file (000005 → versi 5), bukan string 6 digit
```

Embed tidak boleh menunjuk direktori induk (`//go:embed ../../db` ilegal), jadi embed ditaruh di
package `db`:

```go
// db/embed.go
package db

import "embed"

//go:embed migrations/*.sql
var Migrations embed.FS
```

```go
// cmd/migrate/main.go
d, _ := iofs.New(db.Migrations, "migrations") // root FS = package db
m, _ := migrate.NewWithSourceInstance("iofs", d, os.Getenv("DATABASE_URL"))
// m.Up() / m.Steps(-1) / m.Version() / m.Force(v)
```

Dengan cara ini binary `migrate` membawa migrasi di dalam image; VPS tidak butuh file `.sql`
terpisah maupun CLI eksternal.

- `DATABASE_URL` memakai **role migrasi** (`absensi_owner`), bukan role aplikasi.
- Advisory lock otomatis (`pg_advisory_lock`) → dua deploy bersamaan tidak saling menimpa.
- Keluar dengan kode non-zero kalau gagal; deploy berhenti sebelum app baru naik.
- Set `lock_timeout` dan `statement_timeout` di koneksi migrasi (mis. 3s / 60s) supaya migrasi
  tidak menahan tabel berjam-jam.

---

## 5. Alur developer (harian)

```bash
make db-up                 # postgres via compose
make migrate-up            # skema terbaru
make migration name=add_exports
#   → db/migrations/000008_add_exports.up.sql + .down.sql (template)
$EDITOR db/migrations/000008_add_exports.up.sql
make migrate-up
make sqlc                  # regenerate internal/store
make test                  # integration memakai DB nyata
make migrate-down 1 && make migrate-up   # buktikan down/up bisa replay
```

`make migration` membuat template:

```sql
-- 000008_add_exports.up.sql
CREATE TABLE exports (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    uuid NOT NULL REFERENCES users(id),
    kind        text NOT NULL,
    filter      jsonb NOT NULL DEFAULT '{}'::jsonb,
    row_count   integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exports_created_at ON exports (created_at DESC);

-- grant untuk role aplikasi (lihat §8)
GRANT SELECT, INSERT ON exports TO absensi_app;
```

```sql
-- 000008_add_exports.down.sql
DROP TABLE IF EXISTS exports;
```

Aturan penulisan:

- Tanpa `IF NOT EXISTS` pada `CREATE TABLE` (menyembunyikan drift). Pengecualian: index yang
  mungkin di-retry.
- `uuid` pakai `gen_random_uuid()` (Postgres 13+ sudah built-in; ekstensi `pgcrypto` tidak perlu).
- Waktu `timestamptz`, default `now()`.
- Uang: `bigint` unit minor + `char(3)` currency.
- Enum: `text` + `CHECK (...)`; bukan tipe `ENUM` (sulit diubah).
- Constraint bisnis dijaga DB: `UNIQUE`, `CHECK`, FK.
- Setiap tabel baru: index untuk FK + kolom yang dipakai list/report.
- Setiap tabel baru: `GRANT` ke role aplikasi (lihat §8).

---

## 6. Urutan migrasi awal untuk project ini

| # | Migrasi | Isi | Constraint penting |
|---|---|---|---|
| 000001 | `init_extensions` | `citext`, `pgcrypto` (opsional) | — |
| 000002 | `users_sessions` | `users`, `sessions` | `username citext UNIQUE`; `role CHECK IN (...)`; satu `sessions.token_hash UNIQUE` |
| 000003 | `classes_students` | `classes`, `students` | `students.nis UNIQUE`; `qr_hash BYTEA`; `deleted_at` |
| 000004 | `school_settings_days` | `school_settings` (1 baris), `school_days` | `CHECK (id = 1)`; `date PRIMARY KEY` |
| 000005 | `attendance_days` | absensi harian | `UNIQUE (student_id, date)`; `CHECK (check_out_at IS NULL OR check_out_at > check_in_at)`; `status CHECK` |
| 000006 | `attendance_edits_audit` | edit log + audit + trigger anti-update | `audit_log`/`attendance_edits` **INSERT-only** untuk role app |
| 000007 | `reports_indexes` | index laporan | `(date)`, `(class_id, date)`, `(student_id, date DESC)` |
| 000008 | `exports` | jejak export PII | FK actor; index `created_at` |

Detail kolom ada di [03-daily-attendance](03-daily-attendance.md) dan [04-fraud-controls](04-fraud-controls.md).

---

## 7. Pola berbahaya & cara aman

| Pola | Risiko | Cara aman |
|---|---|---|
| `ADD COLUMN ... NOT NULL` tanpa default | rewrite + lock tabel | tambah nullable → backfill → `SET NOT NULL` di rilis berikut |
| `ALTER COLUMN TYPE` | rewrite penuh | kolom baru + backfill + switch + drop lama |
| `RENAME COLUMN/TABLE` | memecah kode lama | tambah baru, dual-write, hapus lama setelah kode berhenti memakai |
| `DROP COLUMN` | kode lama error | rilis setelah kode berhenti memakai (contract) |
| `CREATE INDEX` di tabel besar | lock tulis | data kecil: aman; besar: `CONCURRENTLY` **satu statement per file** (diuji) |
| Backfill di file migrasi | transaksi panjang | `cmd/backfill` batch 1.000, idempoten, di luar jam sibuk |
| Trigger/function `$$` | splitting salah | terbukti aman: golang-migrate mengirim file utuh (diuji) |
| `SET NOT NULL` tanpa cek | gagal di data produksi | `UPDATE ... WHERE IS NULL` dulu, lalu cek `COUNT(*)` |

**Expand/contract contoh** (menambah snapshot kelas di absensi):

1. Rilis A: `ALTER TABLE attendance_days ADD COLUMN class_id uuid REFERENCES classes(id);`
   App menulis `class_id` untuk record baru; backfill batch untuk data lama.
2. Rilis B: `ALTER TABLE attendance_days ALTER COLUMN class_id SET NOT NULL;`
   App membaca `class_id`; kode lama masih jalan (kolom nullable saat rilis A).
3. Rilis C (opsional): hapus kolom lama kalau ada.

---

## 8. Role database & least privilege

Dibuat **sekali** saat provisioning (bukan di migrasi):

| Role | Hak | Dipakai |
|---|---|---|
| `absensi_owner` | owner skema, DDL | `cmd/migrate` |
| `absensi_app` | `SELECT/INSERT/UPDATE/DELETE` tabel biasa; **INSERT-only** `audit_log`, `attendance_edits` | API |
| `absensi_readonly` | `SELECT` | laporan/BI, debugging |

```sql
-- provisioning (sekali)
CREATE ROLE absensi_app LOGIN PASSWORD '...';
CREATE ROLE absensi_readonly LOGIN PASSWORD '...';

-- default untuk tabel baru (dijalankan sebagai owner)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO absensi_app;

-- pengecualian: audit immutable (jalankan di migrasi 000006 setelah tabel dibuat)
REVOKE UPDATE, DELETE ON audit_log, attendance_edits FROM absensi_app;
GRANT INSERT ON audit_log, attendance_edits TO absensi_app;
```

Tambahan pertahanan: trigger `BEFORE UPDATE OR DELETE` pada dua tabel itu → `RAISE EXCEPTION`.
Dengan begitu, bahkan bug di app tidak bisa menimpa audit.

`.env` aplikasi memakai `absensi_app`; migrasi memakai `absensi_owner`. Jangan pernah app
memegang kredensial owner.

---

## 9. Produksi: urutan deploy & rollback

```
1. backup: pg_dump -Fc (atau snapshot provider)
2. docker compose run --rm api /app/migrate up
3. docker compose run --rm api /app/migrate version   # pastikan tidak dirty
4. docker compose up -d api web caddy
5. smoke.sh (health, login, scan uji)
6. sukses → simpan tag "previous"; gagal → rollback image + restore bila perlu
```

Kebijakan rollback:

- **Rollback aplikasi** = image tag sebelumnya. Skema harus tetap kompatibel dengan kode lama →
  itu alasan expand/contract.
- **Rollback skema** di produksi **tidak** memakai `down`; pakai **forward-fix** (migrasi baru).
  `down` hanya untuk dev/test.
- Restore backup hanya untuk kerusakan data, bukan untuk membatalkan migrasi yang sudah benar.
- Kalau migrasi gagal di tengah dan status `dirty`: perbaiki manual, `force` ke versi terakhir yang
  valid, lalu jalankan ulang. **Jangan** `force` tanpa tahu apa yang sudah dieksekusi.

---

## 10. CI: bukti bahwa migrasi bisa dijalankan

Job `db` (Postgres service) menjalankan:

```bash
# 1. dari kosong
go run ./cmd/migrate up

# 2. replay: turun satu, naik lagi
go run ./cmd/migrate down 1
go run ./cmd/migrate up

# 3. sqlc tidak basi (pakai image resmi; build native di macOS bisa gagal — lihat catatan)
docker run --rm -v "$PWD:/src" -w /src sqlc/sqlc:1.28.0 generate -f db/sqlc.yaml
git diff --exit-code -- internal/store

# 4. integration test dengan DB nyata
go test -race ./...
```

Catatan tooling: `go install sqlc` di macOS gagal karena `pg_query_go` bentrok dengan header
SDK (`strchrnul`). Pakai image Docker `sqlc/sqlc:1.28.0` di lokal dan CI, atau runner Linux.

Tambahan gate murah:

- `scripts/check-migration.sh`: tolak `DROP TABLE`, `DROP COLUMN`, `ALTER ... TYPE`, `RENAME`
  tanpa penanda `-- destructive: reviewed` + alasan di PR.
- Cek setiap `CREATE TABLE` punya `GRANT` untuk `absensi_app` (kecuali tabel audit).
- Cek setiap file `*.up.sql` punya pasangan `*.down.sql`.

---

## 11. Seed vs migrasi

| | Migrasi | Seed |
|---|---|---|
| Isi | struktur | data awal |
| Dijalankan | deploy | manual/sekali |
| Idempoten | ya (versioned) | wajib (upsert) |
| Contoh | tabel, index, constraint | superadmin, setting sekolah, kelas awal |

- **Jangan** menaruh data bisnis di migrasi (kecuali referensi statis yang tidak berubah).
- `cmd/seed` membaca env `SEED_ALLOW=true`; membuat superadmin dari `SEED_ADMIN_PASSWORD`
  (wajib diganti saat login pertama), setting sekolah default, dan (opsional) data uji.
- Seed **tidak** dijalankan otomatis di produksi.

---

## 12. Test database

| Kebutuhan | Strategi |
|---|---|
| Integration test | satu template DB: migrasi sekali, `CREATE DATABASE test_wN TEMPLATE` per worker |
| Isolasi per test | transaksi + rollback |
| E2E | DB khusus, migrasi + seed deterministik, reset sebelum suite |
| Debug | `make db-shell` (psql), `make db-reset` |

Jangan mock DB. Bug migrasi/constraint/timezone hanya muncul di Postgres nyata.

---

## 13. Checklist review migrasi (tempel di PR)

- [ ] Ada pasangan `.down.sql`
- [ ] Nama & nomor urut benar; tidak bentrok dengan branch lain
- [ ] Tidak ada `ADD COLUMN NOT NULL` tanpa default pada tabel yang sudah berisi
- [ ] Tidak ada `DROP`/`RENAME`/`ALTER TYPE` (atau sudah ditandai `destructive: reviewed`)
- [ ] Index untuk FK & kolom filter laporan
- [ ] Constraint bisnis dijaga DB (unique/check/FK)
- [ ] `GRANT` untuk `absensi_app` (kecuali tabel append-only)
- [ ] `make migrate-up` + `down 1` + `up` hijau
- [ ] `sqlc generate` dijalankan dan hasilnya di-commit
- [ ] Estimasi durasi pada ukuran data produksi (bukan data lokal)
- [ ] Backup tersedia sebelum deploy

---

## 14. Hasil verifikasi (spike 2026-11-17)

Lingkungan: macOS, Go 1.23, Postgres 17 (Docker), golang-migrate v4.18.1, sqlc 1.28.0 (Docker).

| Yang diuji | Hasil |
|---|---|
| Migrasi multi-statement + `CREATE FUNCTION ... $$` + trigger | ✅ berhasil |
| `CREATE INDEX CONCURRENTLY` sebagai satu-satunya statement | ✅ berhasil |
| `CONCURRENTLY` digabung dengan `CREATE TABLE` di satu file | ❌ *cannot run inside a transaction block* → wajib file terpisah |
| Gagal di tengah file multi-statement | ✅ DDL dibatalkan (tabel tidak ada), versi jadi `dirty=true` |
| `down 1` lalu `up` (replay) | ✅ berhasil |
| Trigger append-only: `UPDATE`/`DELETE` pada `audit_log` | ✅ ditolak `append-only table` |
| Dua proses `migrate up` bersamaan | ✅ proses kedua menunggu (advisory lock), keduanya exit 0 |
| `force` setelah dirty lalu `up` | ✅ pulih |
| sqlc `schema: migrations` (ada `*.down.sql`) | ✅ file down dilewati; model hanya dari up |
| sqlc mem-parse `$$`, `CONCURRENTLY`, `CREATE EXTENSION` | ✅ berhasil |
| `go install sqlc` di macOS | ❌ gagal (pg_query/strchrnul) → pakai Docker |

Yang masih perlu diuji di lingkungan nyata (bukan lokal):

1. `lock_timeout` / `statement_timeout` pada koneksi migrasi saat tabel besar.
2. `GRANT`/`REVOKE` dengan role terpisah (`absensi_owner` vs `absensi_app`) — pastikan role app
   benar-benar ditolak saat `UPDATE audit_log`.
3. Durasi migrasi pada salinan data produksi (bukan data kosong).
4. Perilaku deploy dua replika yang menjalankan migrasi bersamaan (lock sudah terbukti, tetapi
   pastikan deploy script tidak menunggu selamanya).

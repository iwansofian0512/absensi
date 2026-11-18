# 20 — Data, API, dan Database

> Berlaku untuk `schema.ts`, `service.ts`, `queries.ts`, `actions.ts`, `server/**`, `db/**`.

## Aliran

```
page (server) → queries.ts → db
form (client) → actions.ts → [auth → validasi → service → db] → revalidate/redirect
```

- Semua tulis lewat `actions.ts`/route handler. Tidak ada mutasi dari komponen.
- `service.ts` berisi aturan bisnis **murni** (tanpa DB, tanpa HTTP) → paling mudah dites.
- Query DB hanya di `queries.ts`/`server/`. Jangan sebar SQL.

## Validasi & error

- Satu zod schema per bentuk data; tipe diturunkan (`z.infer`), bukan ditulis ulang.
- Validasi di boundary (action/handler), bukan di dalam service untuk hal yang sudah dijamin tipe.
- Error taxonomy: `ValidationError` (400) · `Unauthorized` (401) · `Forbidden` (403) · `NotFound` (404) · `Conflict` (409) · `Internal` (500).
- Jangan menelan error. Jangan mengembalikan `null` untuk kasus yang butuh perhatian.
- Pesan ke pengguna dalam Bahasa Indonesia; detail teknis hanya di log.

## Bentuk respons

- List: `{ items, nextCursor }` (cursor-based) atau `{ items, total }` kalau perlu hitung. Selalu ada limit.
- Tanpa `LIMIT` = tidak boleh merge.
- Tanggal: ISO-8601 UTC di API, format lokal hanya di UI.
- Uang: `amount_minor` (integer) + `currency`; tanpa float di mana pun.

## Database

- Konvensi: `snake_case`, tabel plural, FK `<tabel>_id`, index `idx_<tabel>_<kolom>`, FK wajib index.
- `timestamptz` untuk waktu; `text` untuk teks (bukan `varchar(n)`).
- Invariant yang bisa dijaga DB **wajib** dijaga DB: `CHECK`, `UNIQUE`, FK, `NOT NULL`.
- Migrasi: forward-only, idempoten, tidak diedit setelah jalan di prod.
- Perubahan kolom: **expand → backfill → switch → contract** (3 rilis). Tanpa `DROP`/`RENAME` di rilis yang sama dengan perubahan kode.
- Index baru pakai `CREATE INDEX CONCURRENTLY`; set `lock_timeout` saat migrasi.
- Query list wajib punya index sesuai `WHERE` + `ORDER BY`; `EXPLAIN` untuk data >10k baris.
- N+1 dilarang: batch/join, dan integration test menghitung jumlah query per request.

## Transaksi

- Satu unit kerja = satu transaksi. Jangan transaksi panjang yang menunggu HTTP.
- Efek eksternal (email, payment) **setelah** commit, atau dengan outbox/idempotency key.
- Operasi yang bisa di-retry wajib idempoten (kunci unik / `idempotency_key`).

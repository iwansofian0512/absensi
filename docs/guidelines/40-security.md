# 40 — Security

> Berlaku untuk semua kode, terutama auth, upload, payment, webhook, admin, dan env.

## Otorisasi (sumber kebocoran #1)

- Setiap akses data wajib cek **kepemilikan/izin per resource**, bukan hanya "sudah login".
- Identitas dari session server, **tidak pernah** dari body/query/path.
- Admin: role di DB + audit log untuk aksi sensitif. Jangan "kalau email = email saya".
- Test negatif wajib: user A → resource B = 403/404.

## Input & output

- Validasi di boundary (zod/schema); jangan percaya tipe klien.
- Query selalu parameterized; tanpa string concatenation SQL.
- Escape output; jangan render HTML dari input tanpa sanitasi.
- Upload: batas ukuran, MIME dicek di server, nama file di-generate, simpan di object storage.
- SSRF: allowlist host untuk panggilan keluar yang URL-nya dari pengguna.

## Sesi & transport

- Cookie: `httpOnly`, `secure`, `sameSite=lax` (atau `strict` untuk admin).
- CSRF untuk form non-JSON; CORS allowlist eksplisit (bukan `*` dengan kredensial).
- Rate limit: login, register, reset password, endpoint tulis, webhook.
- Header: CSP, `X-Content-Type-Options`, `Referrer-Policy`, HSTS di prod.

## Webhook & pembayaran

- Verifikasi signature **sebelum** memproses.
- Idempotency key; proses ulang tidak boleh menggandakan efek.
- Simpan event mentah untuk audit; jangan log payload berisi PII/kartu.

## Secret

- Tidak pernah di repo, log, pesan error, screenshot, atau prefix publik.
- `env-check` memblokir env tak tercatat dan nama berbau rahasia dengan prefix publik.
- Kalau secret pernah ter-commit: **rotasi dulu**, baru bersihkan history.

## Dependency

- Update otomatis (Renovate/Dependabot), triage mingguan.
- `npm audit --omit=dev` / `govulncheck` di CI. Tambah dependency baru = ADR singkat.

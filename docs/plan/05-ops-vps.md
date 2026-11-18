# Ops: Deploy VPS (satu mesin, cukup untuk 1 sekolah)

> Target: 1.000 siswa, ~50 staf, puncak 07:00–07:30. Beban kecil; yang penting **aman, bisa
> dipulihkan, dan bisa di-deploy ulang tanpa drama.**

## 1. Spesifikasi & biaya

| Item | Nilai | Catatan |
|---|---|---|
| VPS | 2 vCPU, 4 GB RAM, 60–80 GB SSD | Hetzner/DigitalOcean/Linode, ±$12–24/bln |
| OS | Ubuntu LTS 24.04 | update keamanan otomatis |
| Domain | 1 subdomain | TLS otomatis via Caddy |
| Offsite backup | Object storage (R2/S3) | ±$0–2/bln |
| Monitoring | Sentry + UptimeRobot/BetterStack free | $0 |

Postgres jalan di mesin yang sama (data kecil). Managed DB boleh nanti; jangan sekarang.

## 2. Topologi Compose

```
caddy        :80/443  → TLS otomatis, reverse proxy, header keamanan
web          :8080    → static React (build artifact)
api          :8080    → Go binary (non-root, read-only fs)
postgres     :5432    → volume persisten, tidak dipublish ke host
backup       → cron harian: pg_dump → rclone ke object storage
```

Aturan:

- Postgres **tidak** listen ke `0.0.0.0`; hanya network internal compose.
- Container `api` jalan sebagai user non-root, `read_only: true` kecuali `/tmp`.
- Semua secret lewat `.env` (mode 600, owner deploy), bukan di image/repo.
- Log container dibatasi (mis. `max-size: 10m`, `max-file: 3`).

## 3. Hardening VPS

- [ ] SSH: hanya key, `PermitRootLogin no`, user deploy non-root + sudo terbatas.
- [ ] `ufw`: izinkan 22 (dibatasi IP kalau bisa), 80, 443; tolak sisanya.
- [ ] `fail2ban` untuk SSH (dan Caddy auth kalau perlu).
- [ ] `unattended-upgrades` untuk patch keamanan.
- [ ] Timezone server UTC; aplikasi yang mengurus `Asia/Jakarta`.
- [ ] Docker daemon tidak diekspos; socket tidak di-mount ke container.
- [ ] Swap 2 GB (mencegah OOM saat build/backup).
- [ ] Caddy menambahkan header: HSTS, `X-Content-Type-Options`, `Referrer-Policy`, CSP
      (sesuaikan dengan build Vite), dan batas ukuran body (mis. 2 MB).
- [ ] Rate limit login/scan di **app** (wajib). Caddy inti tidak punya rate limit; kalau ingin
      lapisan kedua di edge, pakai plugin `caddy-ratelimit` (xcaddy) — opsional, bukan pengganti.

## 4. Deploy (GitHub Actions → VPS)

```
PR:   lint, test, build, context gates  (tanpa akses VPS)
main: build image api+web → push GHCR (tag = git sha)
      → SSH: docker compose pull → migrate → up -d → smoke /health
      → tag "previous" disimpan untuk rollback
```

- Migrasi dijalankan **job terpisah** sebelum app baru menerima trafik (`migrate` one-shot).
  Detail tool, urutan, role DB, dan rollback: [07-db-migration](07-db-migration.md).
- Smoke test: `GET /health` + login test account + satu scan uji (read-only bila bisa).
- Rollback: `docker compose up -d` dengan tag sebelumnya; migrasi harus kompatibel dengan kode
  lama (expand/contract).
- Jangan `git pull` + `go build` di VPS (lambat, butuh toolchain, sulit rollback).

## 5. Backup & restore

| Hal | Nilai |
|---|---|
| Metode | `pg_dump -Fc` harian 02:00 |
| Offsite | upload ke object storage, retensi 30 hari |
| Enkripsi | `age`/`gpg` sebelum upload (kunci disimpan di luar server) |
| Verifikasi | `pg_restore --list` otomatis + cek jumlah baris tabel inti |
| Restore drill | **bulan pertama, lalu per kuartal**; catat durasi |
| RPO/RTO realistis | RPO 24 jam, RTO 1–2 jam (bukan PITR) |

Kalau butuh RPO < 24 jam: aktifkan WAL archiving (lebih rumit) atau pindah ke managed Postgres.
Untuk absensi sekolah, kehilangan <1 hari data masih bisa direkonsiliasi dari kertas.

## 6. Monitoring & alert (gratis)

| Yang dipantau | Alat | Alert |
|---|---|---|
| Error FE/BE | Sentry free | error baru / lonjakan |
| Uptime + TLS | UptimeRobot/BetterStack | 2× gagal → Telegram |
| Disk & memori | node_exporter + Grafana Cloud free (atau cron + Telegram) | disk >85%, RAM >90% 10 mnt |
| Log | JSON ke file + rotasi; kirim ke Grafana/Loki free (opsional) | — |
| DB | `pg_stat_statements`, `pg_database_size` | query >1s, koneksi >80% |
| Backup | healthcheck per job | gagal → Telegram |
| Bisnis | query harian | scan gagal >10%, ALPA naik drastis |

Alert yang tidak punya tindakan → hapus. Dashboard satu halaman: scan/menit, error, p95, disk,
backup terakhir, jumlah ALPA.

## 7. Runbook minimum

| Insiden | Langkah pertama |
|---|---|
| App down | cek `docker compose ps` → log api → rollback tag sebelumnya |
| DB down / korup | stop api, restore dump terbaru ke volume baru, verifikasi, start |
| Disk penuh | hapus log lama, vacuum, cek dump lokal; alert sebelum 85% |
| TLS expired | `caddy reload`; cek port 80 terbuka |
| Deploy rusak | rollback image; migrasi dicek kompatibel |
| Scan gagal massal | cek kamera/browser staf, rate limit, jam sesi; sediakan input manual |
| Backup gagal | jalankan manual, cek kredensial object storage, catat |

## 8. Checklist sebelum go-live

- [ ] HTTPS + HSTS; cookie `secure`, `httpOnly`, `sameSite`.
- [ ] `ufw` aktif; Postgres tidak terbuka; SSH key-only.
- [ ] Backup harian jalan + **restore sudah dicoba**.
- [ ] Sentry menerima error uji; alert Telegram sampai.
- [ ] Uptime monitor memantau `/health` dari luar.
- [ ] Rate limit login & scan terbukti menolak.
- [ ] Seed: 1 superadmin, 1 maintainer, 1 viewer, 1 siswa uji.
- [ ] Runbook dicetak/disimpan di tempat yang bisa diakses saat server mati.

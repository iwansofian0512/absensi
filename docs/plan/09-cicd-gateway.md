# CI/CD Flow & Keputusan API Gateway

> Dua pertanyaan: (1) bagaimana flow CI/CD end-to-end, (2) perlukah API gateway?
> Jawaban singkat gateway: **tidak untuk sekarang** — Caddy sebagai edge + otorisasi di app sudah
> cukup. Alasan dan kapan berubah ada di §8–§11.

---

## 1. Prinsip

1. **Pipeline = gate, bukan dokumentasi.** Kalau tidak memblokir merge, itu bukan gate.
2. **Deploy = rutin.** Satu perintah, satu smoke test, satu rollback yang pernah diuji.
3. **Main selalu deployable.** Hotfix = revert + deploy ulang, bukan `--no-verify`.
4. **Migrasi bukan bagian dari start app.** Job terpisah, sebelum app baru menerima trafik.
5. **Yang di-deploy adalah artifact yang sama dengan yang diuji** (image tag = git sha).

---

## 2. Branch & environment

| Hal | Model |
|---|---|
| Branch | `main` (protected) + branch pendek `feat/*`, `fix/*` |
| Merge | squash, 1 PR = 1 slice |
| Environment | `local` (compose), `ci` (ephemeral), `production` (VPS) |
| Staging | **tidak ada** di MVP; pengganti: e2e di CI + smoke di prod |
| Rilis | tag `vX.Y.Z` saat deploy; image tag `sha-<short>` + `latest` |
| Freeze | jangan deploy 06:30–08:30 (puncak scan) dan hari ujian |

Tanpa staging, disiplin yang menggantikan: e2e harus jalan di CI terhadap Postgres nyata, dan
smoke prod harus mencakup login + satu scan uji.

---

## 3. Flow PR (feedback < 8 menit)

```
developer                GitHub Actions                         hasil
─────────                ──────────────                         ─────
git push feat/x   ──►    changes / setup (cache)          ──►   status checks
                         ├─ gitleaks (secret)             ──►   block
                         ├─ go: vet, test, gosec, vuln    ──►   block
                         ├─ db: migrate up + replay       ──►   block
                         ├─ contract: openapi + sqlc diff ──►   block
                         ├─ web: tsc, eslint, vitest      ──►   block
                         ├─ e2e: compose + playwright     ──►   block
                         └─ context: router, env, external──►   block
merge (squash)    ──►    deploy pipeline (§4)
```

Hal yang **tidak** dijalankan di PR: build image produksi (kecuali butuh validasi Dockerfile),
Lighthouse penuh, audit dependency (nightly), restore backup.

---

## 4. Flow deploy (main)

```
merge ke main
   │
   ├─ 1. reusable CI (semua gate PR)
   ├─ 2. build image api + web (multi-stage, tag sha) ──► GHCR
   ├─ 3. ssh VPS:
   │      a. catat tag aktif → simpan sebagai "previous"
   │      b. backup pg_dump (opsional: sebelum migrasi destruktif)
   │      c. docker compose pull
   │      d. docker compose run --rm api /app/migrate up
   │      e. docker compose run --rm api /app/migrate version   # dirty?
   │      f. docker compose up -d --no-deps api web caddy
   │      g. smoke.sh  (health, login, scan uji, cek versi)
   │      h. sukses → simpan tag; gagal → rollback.sh
   └─ 4. Sentry release + notifikasi Telegram
```

Urutan ini penting: **backup → migrate → deploy → smoke**. Kalau migrasi gagal, app lama masih
melayani; kalau smoke gagal, rollback image (skema sudah kompatibel karena expand/contract).

### Rollback

| Titik gagal | Tindakan |
|---|---|
| Gate PR | jangan merge; perbaiki |
| Build image | tidak ada perubahan produksi |
| Migrasi gagal | app lama tetap jalan; perbaiki migrasi, `force` bila dirty, ulangi |
| Smoke gagal setelah deploy | `rollback.sh` ke tag `previous`; verifikasi smoke lagi |
| Bug ditemukan setelah rilis | rollback image, lalu forward-fix |
| Data rusak | restore backup ke instance baru, verifikasi, arahkan app |

---

## 5. Job detail

| Job | Isi | Cache | Block |
|---|---|---|---|
| `secret` | gitleaks | — | ya |
| `go` | `go vet`, `go test -race`, `gosec`, `govulncheck` | `~/go/pkg/mod`, build cache | ya |
| `db` | Postgres service → `migrate up` → `down 1` → `up` → `sqlc generate` + `git diff` | Go cache | ya |
| `contract` | lint OpenAPI, generate tipe FE, diff | pnpm | ya |
| `web` | `tsc`, eslint, vitest, `vite build` | pnpm store | ya |
| `e2e` | `compose up` → Playwright → artifact trace | browser cache | ya |
| `context` | `env-check`, `router --strict`, `external --check` | — | ya |
| `build` | buildx image api/web, push GHCR (sha + latest) | buildx layer cache | hanya main |
| `deploy` | ssh, migrate, up, smoke | — | hanya main |

Target waktu: PR 6–8 menit; deploy 3–5 menit. Kalau lebih, biasanya e2e tidak di-shard atau cache
tidak kena — bukan alasan menambah runner besar.

### Skeleton `deploy.yml`

```yaml
name: deploy
on:
  push: { branches: [main] }
concurrency:
  group: production
  cancel-in-progress: false        # deploy tidak boleh saling menimpa
jobs:
  build:
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: deploy/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/api:${{ github.sha }}
            ghcr.io/${{ github.repository }}/api:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /srv/absensi
            ./deploy/scripts/deploy.sh "${{ github.sha }}"
```

`deploy.sh` yang membuat ini aman: menyimpan tag previous, menjalankan migrasi, smoke, dan
rollback otomatis kalau smoke gagal.

---

## 6. Secrets & permission

| Secret | Di mana | Dipakai |
|---|---|---|
| `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` | GitHub Environment `production` | deploy |
| `GITHUB_TOKEN` | otomatis | push GHCR |
| `DATABASE_URL` (owner) | `.env` di VPS (600) | migrasi |
| `DATABASE_URL` (app) | `.env` di VPS | API |
| Sentry DSN | `.env` / build FE | error tracking |
| Password superadmin seed | `.env`, hanya saat seed | inisialisasi |

Aturan: secret tidak pernah masuk image, log, artifact, atau repo. Deploy key SSH hanya boleh
menjalankan perintah deploy (batasi di `authorized_keys` dengan `command=` kalau bisa).

---

## 7. Nightly & pemeliharaan

| Job | Isi |
|---|---|
| `nightly` | `govulncheck`, `npm audit`, e2e penuh, cek backup terakhir < 24 jam |
| `renovate` | PR dependency otomatis; merge hanya kalau CI hijau |
| mingguan (manual 15 mnt) | baca digest fraud, cek disk, cek error Sentry, cek restore |

---

## 8. Perlukah API gateway?

**Tidak.** Untuk satu aplikasi, satu VPS, satu domain, dan satu backend Go, API gateway
(Kong/APISIX/Traefik penuh) menambah komponen yang harus di-upgrade, di-backup, dan di-debug —
tanpa menyelesaikan masalah yang benar-benar kamu punya.

Yang sering diharapkan dari gateway, dan siapa yang menanganinya sekarang:

| Kebutuhan | Ditangani oleh | Catatan |
|---|---|---|
| TLS, HTTP→HTTPS, HSTS | **Caddy** | otomatis (ACME) |
| Routing `/api` vs SPA | **Caddy** | `reverse_proxy` / `file_server` |
| Header keamanan, body limit | **Caddy** | `header`, `request_body` |
| Kompresi, cache aset | **Caddy** | `encode`, `file_server` |
| Authn (login, session) | **App** | cookie httpOnly |
| Authz per resource | **App** | gateway tidak tahu kepemilikan baris |
| Rate limit per user | **App** | butuh identitas, bukan sekadar IP |
| Validasi payload | **App** | schema |
| Audit & idempotency | **App** | butuh konteks bisnis |
| DDoS dasar | **Cloudflare (opsional)** | proxy gratis di depan VPS |
| Observability | Sentry + log JSON | — |

Gateway yang "menaruh authz di edge" adalah ilusi: gateway tidak tahu apakah siswa A boleh melihat
absensi siswa B. Otorisasi tetap di service.

## 9. Kapan gateway mulai masuk akal (trigger)

Tambahkan gateway hanya kalau salah satu benar-benar terjadi:

1. **Lebih dari satu backend service** yang perlu routing/versioning terpusat.
2. **API dipakai pihak ketiga** (sekolah lain, aplikasi mobile) → butuh API key, kuota per key,
   dokumentasi publik.
3. **Butuh canary/mirroring/AB test** di level trafik.
4. **Butuh mTLS** antar service atau validasi JWT terpusat untuk banyak service.
5. **Butuh WAF terkelola** dan proteksi DDoS level aplikasi (biasanya Cloudflare lebih murah).
6. **Tim > 1** yang butuh kontrak lintas service.

Sampai salah satu terjadi, gateway adalah biaya tanpa manfaat.

## 10. Kalau nanti perlu: stack & flow

| Opsi | Kelebihan | Kekurangan | Cocok untuk |
|---|---|---|---|
| **Caddy** (sekarang) | satu binary, config sederhana, TLS otomatis | rate limit butuh plugin (`caddy-ratelimit` via xcaddy) | 1–2 service |
| **Traefik** | middleware bawaan (rate limit, forward-auth, headers), label Docker | konsep routing agak baru | 2–5 service |
| **Kong** (DB-less) | plugin matang (key-auth, JWT, rate limit), deklaratif | config lebih besar; butuh disiplin | API publik/partner |
| **APISIX** | performa & plugin kuat | butuh etcd; operasional berat | skala besar |
| **Cloudflare** | DDoS/TLS/CDN tanpa server | bukan authz; fitur WAF berbayar | semua tahap (edge) |

Flow kalau gateway ditambahkan (mis. Traefik):

```
Client
  │ HTTPS
  ▼
Cloudflare (opsional: DDoS, TLS, cache)
  ▼
Traefik (routing, rate limit per IP/key, header)
  ├── /api/*  → api:8080   (authz tetap di app)
  └── /*      → web:8080
```

Yang **tetap** di app walaupun ada gateway: session, RBAC per resource, validasi, audit,
idempotency, dan aturan bisnis. Gateway hanya boleh menangani hal lintas-service.

## 11. Rekomendasi final

- **Sekarang:** Caddy sebagai edge + app menegakkan authn/authz/rate limit/audit. Cloudflare
  opsional (gratis) di depan VPS untuk DDoS/TLS/hide origin.
- **Nanti, kalau trigger §9 muncul:** Traefik (paling ringan untuk Docker) atau Kong DB-less
  (kalau API dipakai partner). Jangan APISIX untuk satu VPS.
- **Jangan** menaruh logika bisnis atau authz di gateway, sekarang maupun nanti.

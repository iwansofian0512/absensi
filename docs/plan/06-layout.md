# Layout Workspace, Backend, Frontend, dan CI/CD

> Keputusan: **satu monorepo** untuk `absensi` (Go API + React SPA + migrations + deploy),
> karena dikerjakan solo dan kontrak FE↔BE berubah bersamaan. Dua repo akan memaksa dua PR,
> dua CI, dan sinkronisasi versi manual — biaya yang tidak sebanding.

## 1. Workspace

```
~/dev/
├── web-context-kit/        # kit (dipakai untuk init, tidak di-commit ke project)
└── absensi/                # ← buka ini sebagai workspace DSH
    ├── AGENTS.md           # kontrak repo (auto-load)
    ├── docs/               # arti: spec, domain, invariant, status
    ├── api/ + internal/    # backend Go
    ├── web/                # frontend React
    ├── db/ + openapi/      # kontrak data & API
    ├── deploy/             # compose, Caddy, script
    └── .github/workflows/  # CI/CD
```

Penting: context yang dimuat DSH adalah `AGENTS.md` di root workspace ini. File di
`default-workspace` **tidak** ikut. Jadi buka `~/dev/absensi` sebagai workspace, bukan folder lain.

Kapan memisah jadi dua repo? Kalau frontend dan backend punya siklus rilis berbeda, tim berbeda,
atau frontend dipakai banyak backend. Untuk satu aplikasi & satu orang: jangan.

## 2. Tree lengkap

```
absensi/
├── AGENTS.md                     # aturan repo (≤150 baris)
├── CLAUDE.md                     # stub: "baca AGENTS.md"
├── Makefile                      # dev, verify, test, e2e, db, deploy
├── context-map.mjs               # path → dokumen wajib dibaca
├── docker-compose.dev.yml        # postgres lokal (+ adminer opsional)
├── README.md                     # cara jalanin, 1 halaman
│
├── .github/
│   └── workflows/
│       ├── ci.yml                # PR + main: go, web, contract, e2e, context
│       ├── deploy.yml            # main: build image → GHCR → VPS → migrate → smoke
│       └── nightly.yml           # govulncheck, npm audit, e2e penuh
│
├── docs/
│   ├── stack.md                  # deklarasi stack (Go 1.24, React 19, PG 17, VPS)
│   ├── architecture.md           # alur, tabel inti, boundary
│   ├── status.md                 # sekarang / berikutnya / jebakan
│   ├── specs/
│   │   ├── 001-auth-rbac.md
│   │   ├── 002-students-classes.md
│   │   ├── 003-attendance-daily.md
│   │   ├── 004-qr-protocol.md
│   │   ├── 005-fraud-controls.md
│   │   ├── 006-reports-exports.md
│   │   ├── 007-security-baseline.md
│   │   └── 008-ops-vps.md
│   ├── domains/                  # ARTI per domain, dipakai FE & BE
│   │   ├── auth/README.md
│   │   ├── students/README.md
│   │   ├── attendance/README.md
│   │   └── reports/README.md
│   ├── invariants/{auth,attendance}.md
│   ├── guidelines/00..50.md      # 6 aturan
│   ├── decisions/                # 0001-stack, 0002-qr-static, 0003-daily-attendance
│   ├── design/{tokens,components}.md
│   ├── templates/{spec,feature-README,status}.md
│   ├── generated/env.md          # di-generate, jangan diedit
│   ├── consumers.md              # antarmuka repo lain (kosongkan dulu)
│   └── external.json             # repo lain (kosongkan dulu)
│
├── api/                          # HTTP layer (tipis)
│   ├── router.go
│   ├── middleware/{auth,rbac,requestid,recover,ratelimit}.go
│   ├── health/handler.go
│   ├── auth/handler.go
│   ├── students/handler.go
│   ├── attendance/handler.go
│   └── reports/handler.go
│
├── internal/                     # domain & infrastruktur
│   ├── auth/{service,session,password,policy}.go
│   ├── students/{service,repository,qr,import}.go
│   ├── attendance/{service,repository,scan,alpa_job,clock}.go
│   ├── reports/{service,repository,export}.go
│   ├── audit/{service,repository}.go
│   ├── rbac/{permissions.go,can.go}
│   ├── config/{config.go,validate.go}
│   ├── platform/{db,httpserver,logger,telemetry}.go
│   └── store/                    # sqlc generated (jangan diedit)
│
├── cmd/
│   ├── api/main.go               # server
│   ├── migrate/main.go           # up/down/version
│   ├── seed/main.go              # superadmin + data uji
│   └── alpa/main.go              # job harian 23:30
│
├── db/
│   ├── migrations/0001_init.up.sql / .down.sql ...
│   ├── queries/{students,attendance,reports}.sql
│   └── sqlc.yaml
│
├── openapi/openapi.yaml          # kontrak API (sumber tipe FE)
│
├── web/
│   ├── index.html
│   ├── vite.config.ts
│   ├── playwright.config.ts
│   ├── src/
│   │   ├── main.tsx  App.tsx
│   │   ├── app/{router.tsx,providers.tsx,layout.tsx,error-boundary.tsx}
│   │   ├── features/
│   │   │   ├── auth/{login.tsx,api.ts}
│   │   │   ├── students/{list.tsx,form.tsx,api.ts,ui/}
│   │   │   ├── attendance/{scan.tsx,list.tsx,correction.tsx,api.ts,ui/}
│   │   │   ├── reports/{page.tsx,export.tsx,api.ts}
│   │   │   └── student-portal/{my-attendance.tsx,api.ts}
│   │   ├── components/ui/        # tombol, table, dialog, toast, empty/error
│   │   ├── lib/{http.ts,env.ts,query.ts,datetime.ts,api/}  # api/ = generated
│   │   └── styles/tokens.css
│   └── e2e/{auth.spec.ts,scan.spec.ts,rbac.spec.ts}
│
├── deploy/
│   ├── compose.yml               # caddy, api, postgres, backup
│   ├── Caddyfile
│   ├── .env.example
│   └── scripts/{deploy,rollback,backup,restore,smoke}.sh
│
├── e2e/smoke.sh                  # smoke post-deploy (health + login + 1 scan)
└── scripts/context/{router,env-check,external}.mjs
```

## 3. Backend: aturan boundary

| Lapisan | Boleh impor | Tidak boleh |
|---|---|---|
| `api/*` | `internal/<domain>` service, `internal/rbac`, `middleware` | `internal/store`, SQL langsung |
| `internal/<domain>` | `platform`, `audit`, `rbac`, domain lain **lewat interface** | `net/http`, `api/*`, store domain lain |
| `internal/store` | generated saja | business logic |
| `cmd/*` | wiring semua | logic |

- **Handler tipis:** parse → validasi → panggil service → map error ke HTTP.
- **Service** memegang aturan (telat, koreksi, alpa); **repository** hanya query.
- **Error** di-wrap (`fmt.Errorf("...: %w", err)`), dipetakan ke status di satu tempat.
- **Context** di-thread ke semua I/O; tanpa `context.Background()` di service.
- **Nama package** singular: `attendance`, bukan `attendances`.
- **Satu file satu tanggung jawab**; file >300 baris = sinyal pecah.

## 4. Frontend: aturan boundary

- **Satu fitur satu folder**; `features/a` tidak impor `features/b`.
- Shared hanya lewat `components/ui` dan `lib/`.
- **Tidak ada `fetch` di komponen**; semua lewat `features/*/api.ts` (client dari OpenAPI).
- **Empat state wajib** (loading/empty/error/success) + `unauthorized`.
- **URL adalah state** untuk filter/tanggal/pagination.
- **Tipe API tidak ditulis tangan**: generate dari `openapi/openapi.yaml` ke
  `web/src/lib/api/`; CI gagal kalau basi.
- **Scanner QR**: komponen `features/attendance/scan.tsx`, fallback `@zxing/browser` untuk iOS;
  izin kamera ditangani eksplisit (pesan jelas kalau ditolak).

## 5. Kontrak bersama

```
openapi/openapi.yaml  ──generate──►  web/src/lib/api/  (types + client)
        │
        └──dipakai test kontrak & e2e
```

- OpenAPI ditulis **sebelum** handler/UI untuk endpoint baru.
- CI: lint OpenAPI + generate ulang + `git diff --exit-code` (mendeteksi drift).
- Jangan menduplikasi tipe di FE dan Go. Satu sumber: spec → generate.

## 6. CI/CD

> Detail flow, urutan deploy, rollback, dan keputusan API gateway: [09-cicd-gateway](09-cicd-gateway.md).

### Workflow

| File | Trigger | Job | Isi |
|---|---|---|---|
| `ci.yml` | PR + push main | `go` | `go vet`, `go test -race`, `gosec`, `govulncheck`, migrate-from-scratch + integration (Postgres service) |
| | | `web` | `tsc --noEmit`, ESLint, Vitest, `vite build`, cek ukuran bundle |
| | | `contract` | lint OpenAPI, generate types, `git diff --exit-code` |
| | | `e2e` | compose up → Playwright (chromium) → artifact trace |
| | | `context` | `env-check --md`, `router --strict`, `external --check` |
| `deploy.yml` | push main (setelah ci) | `build` | image `api` + `web`, tag = git sha, push GHCR |
| | | `deploy` | SSH VPS → `migrate` → `compose pull/up` → `smoke.sh`; gagal → `rollback.sh` |
| `nightly.yml` | cron 02:00 | `audit` | `govulncheck`, `npm audit`, full e2e, cek backup terakhir |

Prinsip:

- **Tidak ada preview per PR di VPS.** Terlalu mahal untuk satu mesin; penggantinya: e2e di CI
  dengan compose + Postgres service. Kalau nanti butuh preview, tambah slot staging di VPS yang sama.
- **Semua job memakai cache**: `go mod`, pnpm store, browser Playwright, layer Docker.
- **`main` selalu deployable**; rollback = image tag sebelumnya, bukan revert commit.
- **Migrasi job terpisah** sebelum app baru menerima trafik.
- **Waktu target**: PR feedback < 6 menit.

### Skeleton `ci.yml` (ringkas)

```yaml
name: ci
on:
  pull_request:
  push: { branches: [main] }
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  go:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: absensi_test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 5s --health-retries 10
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/absensi_test
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-go@v5
        with: { go-version: "1.24", cache: true }
      - run: go vet ./...
      - run: go test -race ./...
      - run: go run ./cmd/migrate up
      - run: go run ./cmd/migrate down 1 && go run ./cmd/migrate up   # migrasi bisa di-replay
      - uses: securego/gosec@master
      - run: go run golang.org/x/vuln/cmd/govulncheck@latest ./...

  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm --dir web install --frozen-lockfile
      - run: pnpm --dir web exec tsc --noEmit
      - run: pnpm --dir web exec eslint . --max-warnings=0
      - run: pnpm --dir web exec vitest run
      - run: pnpm --dir web build

  context:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - run: node scripts/context/env-check.mjs --md docs/generated/env.md
      - run: node scripts/context/router.mjs --strict --base origin/${{ github.base_ref || 'main' }}
      - run: node scripts/context/external.mjs --check
```

Job `contract` dan `e2e` mengikuti pola yang sama (e2e: `docker compose up -d` lalu Playwright).

### Alur deploy

```
merge ke main
  → ci (go, web, contract, context) 
  → build image api/web (tag sha) → GHCR
  → ssh: docker compose pull
  → docker compose run --rm migrate up
  → docker compose up -d --no-deps api web caddy
  → smoke.sh (health, login, scan uji)
  → sukses: tag "previous" disimpan | gagal: rollback.sh
```

`.github/workflows/deploy.yml` memakai `environment: production` (secret SSH + GHCR) dan
`concurrency` agar dua deploy tidak bertabrakan.

## 7. Deploy directory

| File | Isi |
|---|---|
| `deploy/compose.yml` | caddy, api, web, postgres (volume), backup (cron) |
| `deploy/Caddyfile` | TLS otomatis, header keamanan, body limit, proxy `/api` |
| `deploy/.env.example` | daftar env non-rahasia; rahasia di server `.env` mode 600 |
| `deploy/scripts/migrate.sh` | jalankan `cmd/migrate` dengan lock |
| `deploy/scripts/smoke.sh` | `/health`, login, scan uji; exit non-zero → rollback |
| `deploy/scripts/rollback.sh` | `compose up -d` dengan tag sebelumnya |
| `deploy/scripts/backup.sh` | `pg_dump -Fc` → enkripsi → object storage; hapus >30 hari |
| `deploy/scripts/restore.sh` | restore ke DB baru + verifikasi jumlah baris |

## 8. Resep menambah fitur (contoh: koreksi absensi)

1. Update spec `003-attendance-daily.md` (perilaku koreksi).
2. Migrasi `0007_attendance_edits` + query sqlc.
3. `internal/attendance/correction.go` (aturan: batas 7 hari, alasan, limit 20).
4. `api/attendance/handler.go` endpoint + permission `attendance.correct` di `rbac/permissions.go`.
5. `web/src/features/attendance/correction.tsx` + test.
6. `docs/domains/attendance/README.md` diperbarui (gate `context-check` menagih).
7. Test: unit aturan, integrasi DB, e2e UI, authz negatif.
8. `make verify`.

Urutan ini yang membuat perubahan tidak menyebar: kontrak dulu, arti diperbarui, baru UI.

## 9. Yang tidak perlu

- Dua repo terpisah, Nx/Turborepo, microservices, Kubernetes.
- GraphQL; OpenAPI + REST cukup.
- State manager FE (Redux/Zustand) sebelum ada kebutuhan nyata; TanStack Query + URL state cukup.
- Preview environment per PR di VPS (pakai e2e compose di CI).
- Storybook; cukup halaman `/dev/components` untuk screenshot.

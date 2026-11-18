# ADR 0001 — Stack Go API + React SPA

- **Tanggal:** 2026-11-18
- **Status:** diterima (diperbarui saat bootstrap; sumber keputusan: `docs/plan/00-discovery.md`)

## Konteks

Project absensi dikerjakan solo, end-to-end (dev → deploy), dengan AI sebagai pelaksana utama.
Satu sekolah, satu VPS, satu backend; kontrak FE↔BE berubah bersamaan.

## Keputusan

Go 1.24 + chi + pgx/v5 + golang-migrate + sqlc + log/slog · PostgreSQL 17 ·
React 19 + Vite + TypeScript + TanStack Query · pnpm · Docker Compose + Caddy di VPS.

Tooling gate: TypeScript, ESLint, Vitest, Playwright, openapi-typescript, gitleaks, gosec,
govulncheck. Semuanya dev/CI-only, bukan runtime dependency.

## Alternatif yang ditolak

- Dua repo (FE/BE terpisah): dua PR, dua CI, sinkronisasi versi manual untuk satu aplikasi.
- Next.js/tRPC/GraphQL: menambah lapisan tanpa kebutuhan; OpenAPI + REST cukup.
- ORM/auto-migrate: schema harus eksplisit, versioned, dan dijalankan job terpisah.
- API gateway (Kong/Traefik/APISIX): tidak menyelesaikan authz per resource; Caddy cukup.
- QR berputar/TOTP: keputusan K3 memilih QR statis; kontrol berlapis + audit.

## Konsekuensi

- Handler tipis: parse → validasi → service → response. Tanpa logika bisnis di handler.
- Error di-wrap (`fmt.Errorf("...: %w", err)`), dipetakan ke status HTTP di satu tempat.
- Query SQL generated oleh sqlc di `internal/store`; tidak ada SQL di handler/service.
- Kontrak API di `openapi/openapi.yaml`; tipe FE generated ke `web/src/lib/api/`.
- Env dibaca sekali di `internal/platform/config` dan divalidasi saat start.
- Caddy tidak menangani authz/rate limit/audit; itu tetap di aplikasi.

## Kapan ditinjau ulang

Kalau ada backend kedua, API dipakai pihak ketiga, butuh canary/mTLS/WAF terpusat, atau tim
lebih dari satu — trigger gateway ada di `docs/plan/09-cicd-gateway.md` §9.

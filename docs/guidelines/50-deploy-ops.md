# 50 — Deploy & Operasional

> Berlaku untuk `.github/**`, `Makefile`, `.env*`, migrasi prod, dan script deploy.

## Environment

| Env | Secret | DB | Catatan |
|---|---|---|---|
| local | `.env.local` (tidak di-commit) | docker compose | `.env.example` lengkap, non-rahasia |
| preview | environment `preview` | DB terpisah | data dummy; jangan data prod |
| prod | environment `production` (reviewer) | DB prod | akses minimum |

- Config lewat env; `NEXT_PUBLIC_*`/`VITE_*` hanya untuk data non-rahasia.
- Env divalidasi saat boot (schema) → app menolak start kalau kurang, bukan `undefined` di runtime.

## Pipeline (urutan yang benar)

```
static (tsc, lint, knip, jscpd, env-check, context-check, gitleaks)
→ unit → db (migrate dari nol + db:check + integrasi) → e2e → build
→ preview + smoke-preview (PR)
→ prod: backup → migrate → deploy → smoke → release
```

- PR feedback target < 6 menit; job mahal (visual penuh, audit, Lighthouse) → nightly.
- `main` selalu deployable. Hotfix = revert, bukan `--no-verify`.

## Migrasi & rollback

- Migrasi job terpisah, pakai advisory lock, log ke artifact.
- Destruktif (DROP/RENAME/NOT NULL tanpa default) → rilis berikutnya, setelah kode berhenti memakai.
- Kode lama harus tetap jalan setelah migrasi (expand/contract).
- Rollback app = deploy commit sebelumnya; **uji minimal sekali** dan catat di runbook.
- Backup: PITR aktif; dump harian ke object storage; **uji restore** dan catat durasinya.

## Observability minimum

- `/health` (proses) dan `/ready` (DB) dipakai uptime monitor.
- Log JSON: `requestId`, `userId` (bukan email), `route`, `durationMs`, `status`; redaksi auth/cookie/body.
- Sentry FE+BE dengan `release=GIT_SHA`, sourcemap diunggah, alert ke email/Telegram.
- Alert hanya yang actionable; setiap alert punya link runbook. Tanpa pager malam untuk non-pendapatan.
- Metrik bisnis ikut dipantau: signup, checkout, webhook gagal, job malam.

## Runbook

`docs/runbook.md` wajib memuat: app down, error rate naik, DB penuh/lambat, webhook gagal,
deploy rusak, restore backup. Satu halaman, perintah konkret.

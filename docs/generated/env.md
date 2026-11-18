# Katalog env (di-generate)

> `env-check.mjs --md` menghasilkan file ini dari pemakaian nyata di kode.
> Jangan edit tangan. Jalankan `make env-check` setelah menambah env.

Di-generate oleh env-check.mjs · dipakai: 4 · dideklarasi: 4

| Key | Cakupan | Ada di .env.example | Dipakai di |
|---|---|---|---|
| `APP_ENV` | server | ya | internal/platform/config/config.go |
| `DATABASE_URL` | server | ya | internal/platform/config/config.go, cmd/migrate/main.go |
| `HTTP_ADDR` | server | ya | internal/platform/config/config.go |
| `LOG_LEVEL` | server | ya | internal/platform/config/config.go |

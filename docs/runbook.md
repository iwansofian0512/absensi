# Runbook

> Satu halaman, perintah konkret. Diperbarui setiap kali ada insiden.
> Slice saat ini: bootstrap. Login/scan belum ada, jadi smoke hanya health + SPA.

## App down
1. `docker compose -f /srv/absensi/deploy/compose.yml ps` → container mana yang mati?
2. `docker compose -f /srv/absensi/deploy/compose.yml logs --tail=200 api`
3. `curl -sS https://<domain>/health` → respons?
4. Rilis baru bermasalah → `deploy/scripts/rollback.sh <tag-previous>`; cek smoke lagi.

## Error rate naik
1. Log JSON API: cari `"level":"ERROR"`, `request_id`.
2. Kalau muncul setelah deploy → rollback image, lalu forward-fix.
3. Jangan menurunkan skema dengan `migrate down` di produksi.

## Migrasi gagal / dirty
1. App lama tetap melayani; jangan panik.
2. Baca error; perbaiki migrasi secara manual bila perlu.
3. `cmd/migrate version` → kalau `dirty: true`, pahami statement yang sudah dieksekusi.
4. `cmd/migrate force <versi-valid>` **hanya** setelah perbaikan manual, lalu `up` lagi.

## DB lambat / penuh
1. `pg_stat_activity`: query lama, lock.
2. `pg_stat_statements`: query teratas.
3. Disk >85% → hapus dump/log lama, vacuum; jangan drop index tanpa alasan.

## Backup & restore
1. Backup harian: `deploy/scripts/backup.sh` (container `backup`, retensi 30 hari).
2. Restore **ke instance baru**, bukan menimpa prod:
   `pg_restore -d <db-baru> /backups/absensi-<stamp>.dump`.
3. Verifikasi jumlah baris tabel inti; catat RTO/RPO.
4. Restore drill belum pernah dijalankan — jadwalkan di S5.

## Disk / TLS / deploy
- Disk penuh: cek `docker system df`, log container (max 10m × 3), dump lokal.
- TLS: `docker compose ... exec caddy caddy reload --config /etc/caddy/Caddyfile`; cek port 80.
- Deploy rusak: rollback image; jangan revert commit sebagai strategi utama.

# Absensi — Discovery v2 (keputusan sudah dikunci)

> Revisi dari v1 setelah keputusan: harian + jam masuk/pulang, akun siswa read-only, QR statis,
> satu sekolah, maintainer boleh koreksi, deploy VPS. Belum ada kode.
>
> Dokumen detail: [RBAC](01-rbac-matrix.md) · [QR](02-qr-attendance.md) ·
> [Absensi harian](03-daily-attendance.md) · [Anti-fraud](04-fraud-controls.md) · [Ops VPS](05-ops-vps.md)

---

## 1. Keputusan yang mengikat

| # | Pertanyaan | Jawaban | Konsekuensi |
|---|---|---|---|
| K1 | Model absensi | **Harian**, dengan jam masuk & pulang | Satu record per siswa per tanggal; dua scan/hari; status telat dihitung dari jam masuk |
| K2 | Akun siswa | **Ada**, hanya melihat data sendiri | Role `student`, provisioning massal, reset password oleh admin, tanpa QR di portal |
| K3 | QR | **Statis** (kartu) | Token opaque + hash; risiko titip-absen dikelola lewat kontrol berlapis, bukan rotasi |
| K4 | Tenancy | **Satu sekolah** | Tanpa `school_id` di semua tabel; satu baris `school_settings`. Multi-sekolah nanti = migrasi sadar |
| K5 | Koreksi oleh maintainer | **Boleh, terbatas & teraudit** | Lihat [04-fraud-controls](04-fraud-controls.md): batas waktu, alasan wajib, approval untuk massal |
| K6 | Deploy | **VPS** | Docker Compose + Caddy (TLS) + Postgres lokal + backup offsite; lihat [05-ops-vps](05-ops-vps.md) |

Yang **tidak** dikerjakan: multi-sekolah, portal orang tua, notifikasi WA/SMS, jadwal pelajaran,
absensi offline, geofencing, wajah/biometrik, payroll.

---

## 2. Scope MVP

**Harus ada:**

1. Login staf (3 role) + login siswa (read-only) + logout + session aman.
2. CRUD siswa + kelas + import CSV + generate/cetak/revoke kartu QR.
3. Absensi harian: scan masuk, scan pulang, status otomatis (hadir/telat), ALPA otomatis.
4. Koreksi absensi oleh maintainer (terbatas) + superadmin (penuh), semuanya teraudit.
5. Laporan harian/bulanan + export (dibatasi role).
6. Audit log, backup, monitoring, runbook.

**Tidak harus ada (nanti):** rekap semester, surat izin digital, integrasi Dapodik, app mobile.

---

## 3. Arsitektur

```
Browser staf/siswa (React + Vite)
        │ HTTPS + session cookie (httpOnly, secure, sameSite)
        ▼
   Caddy (TLS, reverse proxy, rate limit dasar)
        ▼
   Go API (chi) ── authz.can(actor,action,resource) ── audit
        │
        ├── PostgreSQL 17 (sqlc)
        └── Sentry / log JSON / metrik
```

- Satu VPS, satu compose file: `caddy`, `api`, `web` (static), `postgres`, `backup`.
- **Session cookie**, bukan JWT di localStorage. CSRF token untuk request non-GET.
- Otorisasi satu pintu: handler tidak pernah membaca role dari body/query.
- Audit append-only; aplikasi tidak punya hak `UPDATE`/`DELETE` ke tabel audit.
- QR dibaca di browser staf (kamera) — spike iOS wajib di hari pertama (`BarcodeDetector`
  tidak ada di Safari; fallback `@zxing/browser`).

---

## 4. Model data ringkas

| Tabel | Isi | Catatan |
|---|---|---|
| `school_settings` | nama, timezone, jam masuk, batas telat, jam pulang, hari sekolah | satu baris |
| `users` | username (email staf / NIS siswa), password hash, role, `student_id` (siswa), status | role: superadmin/maintainer/viewer/student |
| `classes` | nama rombel, tingkat, wali kelas | |
| `students` | NIS, NISN, nama, class_id, status, `qr_hash`, `qr_version`, `deleted_at` | token QR disimpan hash |
| `school_days` | tanggal, jenis (`SCHOOL/HOLIDAY/EVENT`), catatan | dasar ALPA & laporan |
| `attendance_days` | student_id, class_id (snapshot), date, check_in_at, check_out_at, status, method_in/out, source, note | **unik (student_id, date)** |
| `attendance_edits` | attendance_id, field, old, new, reason, actor, ip, at | append-only |
| `audit_log` | actor, action, target, ringkasan, ip, at | append-only |
| `exports` | actor, filter, jumlah baris, at | jejak PII |

Detail aturan waktu & status: [03-daily-attendance](03-daily-attendance.md).
Detail token QR: [02-qr-attendance](02-qr-attendance.md).

---

## 5. Alur utama

1. **Login** → sesi dibuat; role menentukan menu; siswa hanya melihat dirinya.
2. **Siswa baru** → data dibuat → QR digenerate (secret hanya muncul sekali) → kartu dicetak.
3. **Pagi** → staf pilih "Absen Masuk" → scan kartu → server set `check_in_at`, status
   `HADIR`/`TERLAMBAT` dari `school_settings`.
4. **Sore** → staf pilih "Absen Pulang" → scan → `check_out_at` terisi.
5. **Tidak scan sampai akhir hari** → job malam menandai `ALPA` untuk hari sekolah.
6. **Salah catat** → maintainer koreksi ≤7 hari dengan alasan; >7 hari atau massal → superadmin.
7. **Laporan** → harian per kelas, bulanan per siswa; export tercatat.
8. **Siswa** → login, lihat riwayat & rekap sendiri; tidak bisa mengubah apa pun.

---

## 6. Keamanan: baseline yang diuji (bukan klaim)

Target **OWASP ASVS 4.0 Level 2** + threat model. Fokus khusus aplikasi ini:

| Risiko | Kontrol utama | Dokumen |
|---|---|---|
| Titip absen (QR difoto) | verifikasi visual staf, satu record/hari, audit, laporan anomali | 02, 04 |
| Staf mengubah absensi | batas waktu, alasan, approval massal, audit immutable, deteksi pola | 04 |
| IDOR data siswa | authz per resource + test negatif | 01 |
| Kebocoran PII anak | minimalisasi data, akses berbasis role, export tercatat, retensi | 01, 04 |
| Token QR bocor | hash at rest, revoke/rotate, tidak pernah di list API | 02 |
| Akun siswa disalahgunakan | rate limit, lockout, reset oleh admin, tanpa data teman | 01 |
| Server VPS | firewall, SSH key, update otomatis, backup offsite, restore drill | 05 |

"Prevent semua vulnerability" tetap tidak bisa dijanjikan; yang dijanjikan: baseline diuji,
threat model ditinjau, dan gate otomatis di CI.

---

## 7. Pertanyaan yang masih terbuka (default kalau tidak dijawab)

1. **Jam sekolah**: masuk 07:30, telat setelah 07:45, pulang 15:00? → default itu.
2. **Hari sekolah**: Senin–Jumat atau Senin–Sabtu? → default Senin–Jumat, bisa diubah di setting.
3. **Scan pulang wajib?** Kalau tidak scan pulang, status tetap `HADIR` tapi ditandai
   "tanpa pulang" di laporan, atau otomatis `ALPA`? → default ditandai, bukan ALPA.
4. **Siswa telat**: tetap boleh scan masuk sampai jam berapa? → default sampai 12:00.
5. **Kartu dicetak** (PDF A8) atau ditampilkan di HP staf? → default PDF cetak; portal siswa
   **tidak** menampilkan QR.
6. **Akun siswa**: username = NIS; password awal acak 12 karakter diberikan wali kelas; wajib
   ganti saat login pertama. Setuju? → default ya.
7. **Izin/sakit**: diinput maintainer dengan catatan, atau siswa bisa mengajukan? → default
   maintainer saja (siswa read-only).

---

## 8. Artefak sebelum kode (urutan)

| # | Artefak | Status |
|---|---|---|
| 1 | `docs/stack.md` + ADR stack & deploy | siap ditulis |
| 2 | `001-auth-rbac.md` (dari 01 + detail sesi/password) | draft ada |
| 3 | `002-students-classes.md` (identitas, import, QR issuance) | belum |
| 4 | `003-attendance-daily.md` (dari 03) | draft ada |
| 5 | `004-qr-protocol.md` (dari 02) | draft ada |
| 6 | `005-fraud-controls.md` (dari 04) | draft ada |
| 7 | `006-reports-exports.md` | belum |
| 8 | `007-security-baseline.md` (ASVS L2 mapping) | belum |
| 9 | `008-ops-vps.md` (dari 05) | draft ada |
| 10 | `009-db-migration.md` (dari 07) | draft ada |
| 11 | `010-cicd-gateway.md` (dari 09) | draft ada |
| 12 | `api/openapi.yaml` (sketsa) | belum |

---

## 9. Slice plan

| Slice | Isi | DoD |
|---|---|---|
| S0 | Repo (kit go-react), CI, compose, health, login staf, session, audit skeleton | login jalan; cookie aman; CI hijau |
| S1 | Siswa + kelas + import + QR issue/print/revoke | authz teruji; QR tidak bocor di API |
| S2 | Akun siswa (provisioning, login, portal read-only) | siswa hanya lihat data sendiri; test IDOR |
| S3 | Absensi harian: scan masuk/pulang, status telat, ALPA job | invariant & concurrency teruji |
| S4 | Koreksi + anti-fraud controls + laporan/export | edit teraudit; laporan anomali ada |
| S5 | Hardening: ASVS checklist, rate limit, CSP, backup, restore drill, load test | semua gate hijau; restore terbukti |

Estimasi: **5–7 minggu penuh**, **9–12 minggu** @20 jam/minggu. Akun siswa menambah ~1 minggu.

---

## 10. Risiko & spike

| Risiko | Dampak | Spike |
|---|---|---|
| Kamera QR di iOS Safari | UX staf gagal | halaman uji scan 1 jam, ukur akurasi |
| Static QR difoto | titip absen | uji kontrol 02/04; putuskan apakah cukup |
| Import CSV kotor | data rusak | uji 1.000 baris + NIS duplikat + formula injection |
| Timezone & tengah malam | tanggal salah | test batas 23:59/00:01 |
| Dua staf scan bersamaan | duplikat/race | unique constraint + test paralel |
| VPS mati/disk penuh | layanan berhenti | alert disk + restore drill |

---

## 11. Definisi selesai

1. Setiap role hanya bisa yang ada di matriks — dibuktikan test negatif.
2. Satu siswa satu record per hari; scan ganda idempotent; di luar jendela ditolak.
3. Setiap perubahan absensi punya aktor, alasan, nilai lama/baru — tidak bisa dihapus.
4. QR tidak bisa dipakai lintas hari; token tidak muncul di API/log.
5. ASVS L2 checklist terisi bukti; backup pernah di-restore; rollback pernah diuji.
6. Alert yang menyala benar-benar ditindak.

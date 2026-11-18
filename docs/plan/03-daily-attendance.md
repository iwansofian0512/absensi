# Absensi Harian — Aturan Waktu, Status, dan Edge Case

> Model: **satu record per siswa per tanggal** (`attendance_days`), dengan `check_in_at` dan
> `check_out_at`. Semua waktu disimpan UTC; tanggal dan jam aturan dihitung dari timezone sekolah.

## 1. Setting sekolah (satu baris, bisa diubah superadmin)

| Field | Default | Arti |
|---|---|---|
| `timezone` | `Asia/Jakarta` | dasar tanggal & jam |
| `school_start` | 07:30 | jam masuk resmi |
| `late_after` | 07:45 | lewat ini = `TERLAMBAT` |
| `school_end` | 15:00 | jam pulang resmi |
| `checkin_open` | 06:00 | scan masuk paling awal |
| `checkin_close` | 12:00 | scan masuk paling akhir |
| `checkout_open` | 12:00 | scan pulang paling awal |
| `checkout_close` | 18:00 | scan pulang paling akhir |
| `school_days` | Senin–Jumat | di `school_days` table, bisa override per tanggal |

Mengubah setting **tidak** mengubah record lama (status tersimpan, bukan dihitung ulang).
Kalau perlu hitung ulang, itu operasi eksplisit superadmin + tercatat.

## 2. Kolom wajib di `attendance_days`

`student_id`, `class_id` (snapshot saat record dibuat), `date` (tanggal lokal), `check_in_at`,
`check_out_at`, `status`, `method_in` (`QR/MANUAL/SYSTEM`), `method_out`, `source`, `note`,
`created_at`, `updated_at`.

Snapshot `class_id` penting: siswa yang pindah kelas di tengah bulan tetap muncul di kelas yang
benar pada laporan historis.

## 3. Status

| Status | Kapan | Sumber |
|---|---|---|
| `HADIR` | scan masuk ≤ `late_after` | QR atau manual |
| `TERLAMBAT` | scan masuk > `late_after` | QR atau manual |
| `IZIN` | maintainer input, wajib catatan | manual |
| `SAKIT` | maintainer input, wajib catatan | manual |
| `ALPA` | hari sekolah, tidak ada record sampai job malam | sistem |

`check_out_at` **tidak** mengubah status. Kalau kosong → laporan menandai `tanpa_pulang`.
Kalau pulang sebelum `school_end` → flag `pulang_cepat` (bukan status baru).

## 4. State machine per hari

```
        (hari sekolah, belum ada record)
                    │
       scan IN ─────┼───── maintainer input IZIN/SAKIT
          │         │                │
      HADIR/TERLAMBAT              IZIN/SAKIT
          │                          │
     scan OUT (opsional)         (final, tidak discan)
          │
      HADIR/TERLAMBAT + check_out
          │
   job malam: yang kosong → ALPA
```

Aturan transisi:

1. `HADIR`/`TERLAMBAT` tidak bisa ditimpa oleh scan; hanya koreksi manual (teraudit).
2. `IZIN`/`SAKIT` tidak bisa discan; scan ditolak `EXCUSED_RECORDED` (cegah data ganda).
3. `ALPA` bisa dikoreksi ke status lain oleh maintainer (≤7 hari) dengan alasan.
4. Record `ALPA` yang dibuat job **tidak** dianggap "diedit" — bedakan `source=SYSTEM`.

## 5. Kontrak scan

```
POST /api/v1/attendance/scan
{ mode: "IN" | "OUT", qrPayload, clientDeviceId? }
```

Mode **eksplisit** dari UI (dua tombol), bukan ditebak server. Alasan: perilaku bisa dijelaskan
ke staf dan diaudit; menebak dari waktu menghasilkan bug yang sulit direproduksi.

Urutan validasi (gagal → tolak, jangan lanjut):

| # | Cek | Kode gagal |
|---|---|---|
| 1 | session staf valid + role boleh scan | `UNAUTHORIZED` |
| 2 | rate limit (staf 60/menit, siswa 3/menit) | `RATE_LIMITED` |
| 3 | format & versi QR, siswa ditemukan, hash cocok | `INVALID_QR` |
| 4 | kartu tidak dicabut (`qr_version` cocok) | `EXPIRED_CARD` |
| 5 | siswa aktif | `STUDENT_INACTIVE` |
| 6 | hari ini hari sekolah | `NOT_SCHOOL_DAY` |
| 7 | mode IN: dalam `checkin_open..checkin_close`; OUT: `checkout_open..checkout_close` | `OUTSIDE_WINDOW` |
| 8 | mode IN: belum ada check_in; OUT: sudah ada check_in, belum check_out | `DUPLICATE` / `NOT_CHECKED_IN` |
| 9 | ada record IZIN/SAKIT | `EXCUSED_RECORDED` |
| 10 | insert/update | — |

Hasil sukses mengembalikan: nama, kelas, status, `check_in_at`/`check_out_at`, `duplicate`,
`late_minutes` — cukup untuk verifikasi visual staf.

**Idempotensi:** unique index `(student_id, date)`; dua scan bersamaan → satu menang,
yang lain mendapat `DUPLICATE` dengan data yang sama (bukan 500).

## 6. Job ALPA malam

- Jalan 23:30 timezone sekolah (cron).
- Untuk setiap siswa aktif × hari sekolah hari itu tanpa record → insert `ALPA`, `source=SYSTEM`.
- Idempoten: `ON CONFLICT DO NOTHING`; aman dijalankan ulang.
- Log jumlah record dibuat; kirim ringkasan ke dashboard/Telegram.
- Kalau job gagal: tombol "rekonsiliasi" untuk superadmin (menjalankan ulang untuk tanggal tertentu).

## 7. Koreksi (ringkas; detail di 04)

- Field yang boleh dikoreksi: status, `check_in_at`, `check_out_at`, catatan.
- Tidak ada delete. Nilai lama disimpan di `attendance_edits`.
- `check_out_at` harus > `check_in_at`; koreksi yang melanggar ditolak.
- Alasan wajib (min. 15 karakter), aktor + IP + user agent dicatat.

## 8. Edge case yang wajib punya jawaban

| Kasus | Perilaku |
|---|---|
| Siswa lupa scan masuk, datang jam 10:00 | maintainer koreksi manual (bukan scan) + alasan |
| Siswa scan masuk 2× | scan kedua `DUPLICATE`, tidak membuat record baru |
| Siswa scan pulang sebelum scan masuk | `NOT_CHECKED_IN` |
| Siswa izin tapi tetap scan | `EXCUSED_RECORDED`; maintainer yang memutuskan |
| Hari libur, ada yang scan | `NOT_SCHOOL_DAY` |
| Scan jam 23:59 vs 00:01 | tanggal mengikuti timezone sekolah, bukan UTC |
| Dua staf scan siswa yang sama di detik sama | satu sukses, satu `DUPLICATE` |
| Siswa pindah kelas di tengah bulan | laporan historis pakai kelas saat record dibuat (simpan `class_id` snapshot) |
| Siswa dihapus | soft delete; record historis tetap dan tetap tampil di laporan lama |

## 9. Test wajib

1. Scan IN sebelum `checkin_open` → `OUTSIDE_WINDOW`.
2. Scan IN 07:46 → `TERLAMBAT` + `late_minutes=1`.
3. Scan IN 07:44 → `HADIR`.
4. Scan IN dua kali → record tetap satu, hasil kedua `DUPLICATE`.
5. Scan OUT tanpa IN → `NOT_CHECKED_IN`.
6. Scan OUT dua kali → `DUPLICATE`.
7. Scan hari libur → `NOT_SCHOOL_DAY`.
8. IZIN lalu scan → `EXCUSED_RECORDED`.
9. Job ALPA dua kali → jumlah record sama.
10. Dua request scan paralel → satu record.
11. Tanggal 23:59 WIB tersimpan sebagai tanggal lokal yang benar.
12. Koreksi `check_out` < `check_in` → ditolak.

# Anti-Fraud: Maintainer Boleh Mengubah Absensi, Tapi Tidak Bebas

> Jawaban untuk pertanyaan: "maintainer apakah bisa mengubah absensi, bagaimana supaya tidak fraud?"
>
> Ringkas: **boleh, tetapi tidak ada penghapusan, tidak ada perubahan tanpa jejak, dan pola
> penyalahgunaan harus terlihat.** Fraud tidak bisa dicegah 100%; yang bisa dibuat adalah
> mahal, terlihat, dan bisa dibuktikan.

## 1. Aktor & motif

| Aktor | Motif | Contoh |
|---|---|---|
| Siswa | nilai kehadiran, bolos | kirim foto QR ke teman; minta staf "bantu" |
| Maintainer | membantu siswa/keluarga, menutupi kesalahan | ubah ALPA → HADIR, isi absensi massal |
| Staf dengan akun dibagi | malas login / titip | satu akun dipakai beberapa orang |
| Orang luar | sabotase / data | akses akun lemah, IDOR |

## 2. Aturan edit (dikunci di service, bukan di UI)

| Aturan | Nilai |
|---|---|
| Hapus record | **tidak ada** (hanya koreksi) |
| Field yang bisa diubah | status, `check_in_at`, `check_out_at`, catatan |
| Batas waktu maintainer | ≤7 hari kalender |
| Di luar 7 hari | hanya superadmin |
| Alasan | wajib, min. 15 karakter, tidak boleh generik ("salah") |
| Perubahan massal | hanya superadmin; maintainer ditolak |
| Batas harian maintainer | 20 edit/hari; lebih → eskalasi superadmin |
| Edit di luar jam kerja (22:00–05:00) | tetap boleh, ditandai `off_hours` untuk review |
| Snapshot | nilai lama & baru disimpan per field |
| Metadata | aktor, IP, user agent, waktu, sumber (`UI/API`) |
| Record asli | tetap ada; yang berubah adalah nilai saat ini |

**Kenapa bukan "approval queue" di MVP:** menambah tabel request + UI approval + notifikasi.
Untuk 1 sekolah, batas keras + audit + laporan harian lebih murah dan cukup. Approval queue
dicatat sebagai *future work* kalau volume edit tinggi.

## 3. Kontrol: pencegahan vs deteksi

| # | Kontrol | Jenis | Menangkap |
|---|---|---|---|
| 1 | Tidak ada delete; edit append-only | pencegahan | menghilangkan bukti |
| 2 | Batas 7 hari + role tier | pencegahan | koreksi sejarah jauh |
| 3 | Alasan wajib + panjang minimum | pencegahan | edit asal-asalan |
| 4 | Batas 20 edit/hari | pencegahan | bersih-bersih massal |
| 5 | Bulk = superadmin | pencegahan | perubahan massal terselubung |
| 6 | Audit immutable (role DB tanpa UPDATE/DELETE) | pencegahan | manipulasi log |
| 7 | Tanda `diedit` + riwayat di UI & laporan | deteksi | penyembunyian |
| 8 | Digest harian ke superadmin | deteksi | pola tak biasa |
| 9 | Rasio manual vs QR per staf | deteksi | absensi karangan |
| 10 | Edit di luar jam + ALPA→HADIR | deteksi | pola musiman |
| 11 | Siswa melihat record sendiri | deteksi | siswa melaporkan kejanggalan |
| 12 | Spot check acak 10 record/minggu | deteksi | kolusi halus |

## 4. Digest harian (Telegram/email ke superadmin)

Dikirim 23:45 waktu sekolah, isinya:

```
Tanggal: 2026-11-16 (Senin)
Scan sukses: 812 (IN 410, OUT 402)   Scan gagal: 37
Manual: 12   Koreksi: 5   ALPA: 8   Tanpa pulang: 23
Koreksi per aktor: Budi 3, Sari 2
Tanda: 1 aktor mengubah 3 ALPA→HADIR; 2 edit di luar jam
```

Angka yang perlu dilihat, bukan semua angka. Kalau digest ini tidak pernah dibaca, fraud control
ini tidak ada gunanya — masukkan ke ritual 15 menit/minggu.

## 5. Laporan deteksi (mingguan)

| Laporan | Definisi | Ambang perhatian |
|---|---|---|
| Rasio manual per staf | `manual / total` per aktor | >10% |
| Koreksi per aktor | jumlah edit 7 hari | >20 atau 3× rata-rata |
| ALPA→HADIR | jumlah per aktor | >3/hari |
| Edit di luar jam | 22:00–05:00 | ada saja → review |
| Siswa sering dikoreksi | >3 koreksi/bulan | review |
| Scan gagal per staf | `INVALID_QR` + `OUTSIDE_WINDOW` | >15% dari scan |
| Akun dipakai bersamaan | 2 IP/device berbeda <5 menit | investigasi |

Implementasi: query SQL + halaman laporan sederhana; bukan ML, bukan dashboard baru.

## 6. Audit yang tidak bisa dihapus

- Tabel `audit_log` dan `attendance_edits` hanya `INSERT` untuk role aplikasi.
- Role aplikasi **tidak** punya `UPDATE`/`DELETE` pada kedua tabel (grant terpisah).
- Tambahan: trigger `BEFORE UPDATE OR DELETE` → `RAISE EXCEPTION` (pertahanan berlapis).
- Retensi minimal 2 tahun; backup ikut.
- Superadmin pun tidak bisa menghapus lewat aplikasi; kalau perlu koreksi administratif,
  itu operasi DBA yang tercatat di luar aplikasi.

## 7. Yang harus terlihat oleh pengguna

- Di daftar absensi: badge **"diedit"** + siapa & kapan (hover/detail).
- Di portal siswa: riwayat termasuk koreksi (transparansi), plus tautan "laporkan ke admin".
- Di export: kolom `method`, `edited`, `edited_by`, `edited_at`.
- Laporan tidak boleh menyembunyikan `MANUAL` seolah-olah `QR`.

## 8. Residual risk (harus diterima secara sadar)

| Risiko | Kenapa tidak hilang | Mitigasi |
|---|---|---|
| Kolusi staf–siswa | staf bisa mengoreksi dengan alasan masuk akal | audit + spot check + rotasi tugas |
| Akun staf dibagi | password dibagikan | idle timeout, larangan berbagi, audit device |
| QR difoto & dikirim | QR statis (keputusan K3) | verifikasi visual + satu record/hari + audit |
| Superadmin nakal | akses tertinggi | audit tidak bisa dihapus; backup offsite terpisah |
| Edit halus (1–2 record) | sulit dideteksi | spot check acak |

Kalau absensi dipakai untuk keputusan bernilai tinggi (kenaikan kelas, beasiswa), naikkan:
koreksi >1 hari butuh persetujuan superadmin, dan QR berputar (opsi C di 02).

## 9. Test yang membuktikan kontrol ini bekerja

1. Maintainer menghapus record → endpoint tidak ada / 405.
2. Maintainer mengedit record 8 hari lalu → 403.
3. Maintainer mengedit massal (bulk) → 403.
4. Edit tanpa alasan / alasan <15 karakter → 400.
5. Edit ke-21 dalam sehari → 403.
6. Setelah edit, `attendance_edits` berisi old/new/actor/reason; record utama berubah.
7. Role aplikasi mencoba `UPDATE audit_log` → error DB.
8. Export memuat `method` dan `edited_by`.
9. Siswa melihat koreksi pada record-nya.
10. Digest harian terkirim (test job).

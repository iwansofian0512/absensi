# QR Absensi — Desain Terpilih (statis, dipindai staf)

> Keputusan: **QR statis** di kartu, **staf memindai** dengan kamera browser. Siswa tidak
> menampilkan QR di portal (mengurangi penyebaran screenshot), dan tidak ada akun siswa untuk scan.

## 1. Kenapa statis (dan apa konsekuensinya)

| | Statis (dipilih) | Berputar (TOTP) |
|---|---|---|
| Biaya | Rendah: cetak kartu, tanpa app siswa | Tinggi: app, baterai, jaringan |
| Anti-screenshot | Lemah | Kuat |
| Offline | Kartu selalu ada | Butuh HP hidup |
| Operasional sekolah | Familiar | Perlu sosialisasi |

Karena statis, **titip absen lewat foto QR tetap mungkin**. Yang kita lakukan bukan menghilangkannya,
tapi membuatnya: (a) butuh kehadiran fisik pemegang kartu, (b) terlihat oleh staf, (c) tercatat,
(d) bisa dicabut saat kartu hilang. Kalau nanti dibutuhkan, naik ke rotasi tanpa migrasi data
(cukup tambah `rotating=true` + endpoint challenge).

## 2. Format token

```
ABS1.<studentPublicId>.<secretBase64url>
```

- `studentPublicId` = UUID acak (bukan NIS/NISN) — aman di log/URL.
- `secret` = 32 byte acak (256-bit), disimpan **SHA-256** + `qr_version`.
- Payload **tidak** memuat nama, NISN, kelas, atau tanggal lahir. Kartu hilang tidak membocorkan
  identitas.
- QR tidak pernah dikembalikan di API list/detail; hanya endpoint khusus cetak (berizin) yang
  merender dari secret saat dibuat.

## 3. Lifecycle

| Kejadian | Aksi | Catatan |
|---|---|---|
| Siswa dibuat | generate secret, simpan hash, `qr_version=1` | secret ditampilkan sekali untuk cetak |
| Cetak kartu | endpoint `GET /students/{id}/qr-card` (maintainer+) | dirender server-side → PDF; audit |
| Kartu hilang/bocor | `POST /students/{id}/qr/rotate` | hash baru, versi+1; kartu lama mati |
| Siswa nonaktif/lulus | status nonaktif | scan ditolak `STUDENT_INACTIVE` |
| Portal siswa | **tidak menampilkan QR** | mengurangi screenshot & sharing |
| Audit | cetak, rotate, revoke dicatat | siapa, kapan, siswa mana |

## 4. Alur scan

```
Staf pilih mode (Masuk/Pulang) → kamera → decode → POST /attendance/scan
{ mode: "IN"|"OUT", qrPayload, clientDeviceId? }
```

Validasi berurutan (detail di [03](03-daily-attendance.md)):

1. Session staf + role (`maintainer`/`superadmin`) → `UNAUTHORIZED`
2. Rate limit (staf 60/menit, siswa 3/menit) → `RATE_LIMITED`
3. Parse & versi QR; cari siswa; bandingkan hash constant-time → `INVALID_QR`
4. `qr_version` cocok → `EXPIRED_CARD`
5. Siswa aktif → `STUDENT_INACTIVE`
6. Hari sekolah → `NOT_SCHOOL_DAY`
7. Jendela waktu sesuai mode → `OUTSIDE_WINDOW`
8. State valid (belum IN untuk mode IN; sudah IN untuk OUT) → `DUPLICATE` / `NOT_CHECKED_IN`
9. Belum ada IZIN/SAKIT → `EXCUSED_RECORDED`
10. Simpan; kembalikan nama, kelas, status, waktu, `duplicate`, `late_minutes`

**Idempotensi:** unique `(student_id, date)`; dua scan paralel → satu sukses, satu `DUPLICATE`
dengan data yang sama.

## 5. Kontrol anti-titip-absen untuk QR statis

| Lapis | Kontrol | Efek |
|---|---|---|
| 1 | Scan hanya di hari sekolah & jendela waktu | Membatasi konteks |
| 2 | Satu record per hari; scan ganda `DUPLICATE` | Mencegah dobel |
| 3 | Staf melihat nama + kelas + (opsional foto) | Orang lain tidak bisa "mewakilkan" tanpa terlihat |
| 4 | Mode IN/OUT eksplisit + audit semua percobaan | Bisa direkonstruksi |
| 5 | Deteksi anomali: siswa discan staf berbeda <2 mnt; rasio scan gagal tinggi | Sinyal investigasi |
| 6 | Rotate saat kartu hilang | Mencabut token |
| 7 | (Opsional) tampilkan foto siswa di layar scan | Verifikasi visual lebih kuat |

Residual risk: siswa mengirim foto QR ke teman yang **hadir fisik** di sekolah. Lapis 2–5 membuat
ini berisiko, tapi tidak mustahil. Untuk keputusan bernilai tinggi, naikkan ke QR berputar.

## 6. Threat model ringkas

| Aset | Aktor | Ancaman | Kontrol | Residual |
|---|---|---|---|---|
| Integritas absensi | Siswa | Titip absen (foto QR) | lihat lapis 1–5 | Sedang |
| Integritas absensi | Maintainer | Koreksi/isi manual tanpa dasar | audit, batas waktu, digest, spot check | Rendah–sedang |
| Token QR | Orang luar | Brute force | 256-bit + rate limit | Rendah |
| Token QR | Pemegang kartu | Kartu hilang | rotate/revoke | Rendah |
| PII siswa | Orang dalam | Ekspor massal | authz, audit ekspor, batas baris | Rendah |
| Akun staf | Mantan staf | Akses lanjut | nonaktif = cabut sesi | Rendah |

## 7. Yang tidak boleh dilakukan

- Menyimpan token plaintext (DB bocor = kartu bisa dipalsukan).
- Menaruh NISN/nama di payload QR.
- Mengembalikan `qr_hash`/token di `GET /students`.
- Memvalidasi QR hanya di client.
- Menganggap `DUPLICATE` sebagai error 500.
- Menampilkan QR di portal siswa "supaya praktis".
- Mengandalkan GPS/geofence untuk anti-titip-absen.

## 8. Keputusan kecil yang masih terbuka

1. Jendela scan: `06:00–12:00` (IN) dan `12:00–18:00` (OUT)? → default itu.
2. Kartu: PDF A8 (kartu pelajar) atau label? → default PDF A8.
3. Foto siswa di layar scan? → default tidak di MVP (data PII tambahan), tetapi disarankan.
4. Apakah kartu dicetak sekali di awal tahun? → default ya; rotate hanya saat hilang.

# Matriks Hak Akses (draft v2 — sudah termasuk akun siswa)

> Keputusan: siswa **punya akun**, hanya untuk melihat data sendiri. Tidak ada akses ke data
> siswa lain, tidak ada akses QR (QR hanya di kartu cetak), tidak ada perubahan data.

## Peran

| Peran | Tujuan | MFA | Catatan |
|---|---|---|---|
| `superadmin` | user, role, setting, audit, koreksi penuh, bulk | wajib | minimal 1 aktif |
| `maintainer` | siswa, kelas, absensi, koreksi ≤7 hari, export | disarankan | tidak bisa kelola user |
| `viewer` | melihat & laporan; tidak mengubah | tidak | export agregat saja |
| `student` | melihat absensi & profil sendiri | tidak | terikat `student_id` |

## Matriks izin

Legenda: ✅ boleh · ⚠️ bersyarat · ❌ tidak.

| Resource / aksi | superadmin | maintainer | viewer | student |
|---|---|---|---|---|
| Users: lihat / buat / ubah role / nonaktifkan / reset password | ✅ | ❌ | ❌ | ❌ |
| Settings sekolah | ✅ | ❌ | ❌ | ❌ |
| Audit log | ✅ | ❌ | ❌ | ❌ |
| Students: lihat daftar | ✅ | ✅ | ✅ | ❌ |
| Students: lihat **diri sendiri** | ✅ | ✅ | ✅ | ✅ (hanya `student_id` sendiri) |
| Students: tambah / ubah | ✅ | ✅ | ❌ | ❌ |
| Students: hapus (soft delete) | ✅ | ✅ | ❌ | ❌ |
| Students: import CSV | ✅ | ✅ | ❌ | ❌ |
| Students: lihat/print QR | ✅ | ✅ | ❌ | ❌ (QR tidak di portal) |
| Students: rotate/revoke QR | ✅ | ✅ | ❌ | ❌ |
| Classes: lihat | ✅ | ✅ | ✅ | ✅ (kelas sendiri) |
| Classes: buat/ubah/hapus | ✅ | ✅ | ❌ | ❌ |
| Attendance: lihat semua | ✅ | ✅ | ✅ | ❌ |
| Attendance: lihat sendiri | ✅ | ✅ | ✅ | ✅ |
| Attendance: scan QR (IN/OUT) | ✅ | ✅ | ❌ | ❌ |
| Attendance: input manual | ✅ | ✅ | ❌ | ❌ |
| Attendance: koreksi ≤7 hari | ✅ | ✅ | ❌ | ❌ |
| Attendance: koreksi >7 hari | ✅ | ❌ | ❌ | ❌ |
| Attendance: koreksi massal | ✅ | ❌ | ❌ | ❌ |
| Reports: lihat | ✅ | ✅ | ✅ | ❌ |
| Reports: export identitas | ✅ | ✅ | ❌ | ❌ |
| Reports: export agregat | ✅ | ✅ | ✅ | ❌ |
| Laporan fraud/digest | ✅ | ❌ | ❌ | ❌ |

## Aturan scope

1. **Deny by default.** Setiap endpoint mendeklarasikan izin; tidak ada endpoint "publik" kecuali
   login dan health.
2. **Student = data sendiri.** `student_id` diambil dari session, **bukan** dari query/path.
   Request ke ID lain → 404 (bukan 403, agar tidak membocorkan keberadaan data).
3. **Viewer tidak melihat token/PII sensitif**: `qr_hash`, password hash, IP, catatan internal.
4. **Koreksi berjenjang** (detail di [04](04-fraud-controls.md)): ≤7 hari maintainer; >7 hari
   superadmin; massal superadmin; alasan wajib.
5. **Superadmin tidak bisa menghapus dirinya** atau menurunkan superadmin terakhir.
6. **Session:** idle 30 menit, absolute 8 jam; login baru mencabut sesi lama (satu perangkat).
7. **Siswa:** login memakai NIS; rate limit sama; tidak bisa mengubah profil sendiri (MVP).

## Invariant auth

- `INV-auth-01` — role hanya diubah superadmin; perubahan tercatat (before/after).
- `INV-auth-02` — minimal satu superadmin aktif.
- `INV-auth-03` — user nonaktif tidak bisa login; sesinya dicabut.
- `INV-auth-04` — password Argon2id, min. 12 karakter; tidak pernah di log.
- `INV-auth-05` — perubahan email wajib verifikasi ulang.
- `INV-auth-06` — student hanya bisa membaca resource dengan `student_id` = miliknya.
- `INV-auth-07` — tidak ada endpoint yang menerima `role` atau `student_id` dari client.

## Test negatif wajib

| Skenario | Harapan |
|---|---|
| Viewer POST/PUT/DELETE apa pun | 403 |
| Maintainer membuka `/users` | 403 |
| Maintainer koreksi 8 hari lalu | 403 |
| Maintainer koreksi massal | 403 |
| Student membuka `/students/{id-lain}` | 404 |
| Student membuka `/attendance?student_id=lain` | data sendiri / 404 |
| Student memanggil scan | 403 |
| Request tanpa session / expired | 401 |
| `role` dimanipulasi di body | diabaikan |
| Export oleh viewer berisi NISN | ditolak |
| Superadmin menurunkan dirinya saat satu-satunya | ditolak |

## Pertanyaan terbuka

1. Apakah maintainer boleh menghapus siswa? (default: boleh, soft delete)
2. Apakah viewer boleh melihat nama siswa di laporan? (default: boleh; export identitas tidak)
3. Apakah wali kelas hanya boleh melihat kelasnya? (default: tidak di MVP; perlu scope tambahan)
4. Siapa yang boleh mereset password siswa? (default: maintainer, tercatat; superadmin juga)

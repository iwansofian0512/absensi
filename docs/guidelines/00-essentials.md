# 00 — Essentials (selalu berlaku)

> Digest aturan yang berlaku di semua bagian repo. Detail ada di file 10–50.
> Kalau aturan di sini bertentangan dengan file lain, file ini yang menang.

## Non-negotiable

1. **Spec sebelum kode.** Perubahan perilaku butuh `docs/specs/<slug>.md`. Tidak ada spec → tanya, jangan mengarang.
2. **Bukti, bukan klaim.** "Selesai" hanya setelah `make verify` hijau dan outputnya ditempel.
3. **Satu vertical slice per PR.** Jangan campur fitur, refactor, dan rename.
4. **Dependency/abstraksi baru butuh ADR** di `docs/decisions/`.
5. **Reuse dulu.** Cek `src/components/ui` dan fitur lain sebelum membuat komponen/util baru.
6. **Validasi & otorisasi di server.** Semua input lewat schema. Otorisasi per-resource, bukan hanya "sudah login".
7. **Jangan sentuh yang tidak diminta.** Tanpa refactor tetangga, tanpa reformat file lain.
8. **Design ikut token.** Tanpa hex/px acak, font baru, atau gradient dekoratif.
9. **Uang = integer unit minor. Waktu = UTC di DB, `Asia/Jakarta` di tampilan.**
10. **Secret tidak masuk repo, log, pesan error, atau `NEXT_PUBLIC_*`/`VITE_*`.**
11. **Migrasi forward-only**, expand → migrate → contract. Destruktif butuh backup + rollback.
12. **Test untuk aturan bisnis; E2E untuk journey.** Perilaku berubah tanpa test = PR belum selesai.

## Protokol context (wajib, murah)

- Mulai: baca `AGENTS.md` → `docs/stack.md` → `docs/status.md`.
- Sebelum menyentuh kode: `make context` (atau baca `context-pack.md`).
- Kalau mengubah lapisan arti (`service`, `actions`, `app/**`, `server/**`): perbarui
  `README.md` fitur / `docs/invariants/` di PR yang sama. Gate akan menagih.
- Selesai: perbarui `docs/status.md` (3 baris) dan commit dengan alasan, bukan hanya perubahan.

## Definition of Done

- [ ] Spec/invariant diperbarui kalau perilaku berubah
- [ ] `make verify` hijau (output ditempel)
- [ ] E2E/screenshot untuk UI yang berubah (390/768/1440)
- [ ] State loading/empty/error/unauthorized terlihat benar
- [ ] Preview deploy dicek, bukan diasumsikan
- [ ] Tanpa `console.log`, TODO tanpa tiket, atau mock di jalur produksi
- [ ] Rollback diketahui (deploy sebelumnya; migrasi aman untuk kode lama)

## Saat ragu

Berhenti. Tulis 2 opsi + tradeoff + rekomendasi, lalu tanya. Jangan memilih diam-diam.

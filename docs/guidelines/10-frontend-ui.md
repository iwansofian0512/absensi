# 10 — Frontend & UI

> Berlaku untuk `src/app/**`, `src/components/**`, `src/features/*/ui/**`.

## Aturan yang ditegakkan

1. **Server component default.** `"use client"` hanya di leaf yang butuh interaktivitas; alasan ditulis 1 baris di komentar file. Client component yang mengambil data sendiri = pelanggaran.
2. **Tanpa `fetch` di komponen.** Baca lewat `queries.ts`, tulis lewat `actions.ts`.
3. **Tanpa logika bisnis di JSX.** JSX memetakan data → elemen; perhitungan di `service.ts`/helper murni.
4. **Satu schema validasi** dipakai form (client) dan action (server). Tidak ada validasi duplikat yang bisa berbeda.
5. **Empat state wajib:** loading, empty, error, success. Plus `unauthorized` dan `not-found` di level halaman.
6. **URL adalah state:** filter, sort, tab, pagination di query string — bukan `useState`. Harus bisa di-share dan diuji E2E.
7. **Tanpa state turunan di `useEffect`.** Hitung saat render; `useEffect` hanya untuk sinkronisasi eksternal.
8. **Token, bukan angka ajaib.** Tanpa `#hex`, `text-[13px]`, `mt-[18px]`. Lihat `docs/design/tokens.md`.
9. **Reuse sebelum cipta.** Cek `components/ui` dulu; komponen baru butuh alasan 1 baris di PR.
10. **Dependency butuh ADR** — terutama tanggal, form, ikon, tabel, state manager.
11. **Batas ukuran sebagai alarm:** komponen >150 baris, page >80 baris → pecah.
12. **Aksesibilitas minimum:** input punya label, focus ring terlihat, kontras ≥4.5, bisa keyboard, toast pakai `aria-live`.

## Isolasi & impor

- `ui/*` **tidak** impor `queries.ts`, `actions.ts`, atau DB — hanya props.
- `features/a` **tidak** impor `features/b`; share lewat `lib/` atau `components/ui`.
- `app/**` hanya menyusun layout + feature.

## Komponen & state

Daftar komponen + state wajib ada di `docs/design/components.md`. Halaman `/dev/components`
(hanya dev) merender semuanya; Playwright memotretnya di 390/768/1440 sebagai baseline visual.

## Larangan eksplisit (sumber "AI look")

- Menambah warna/font/shadow baru tanpa mengubah token.
- Gradient dekoratif, glassmorphism, emoji sebagai ikon, 3 library ikon berbeda.
- `lorem ipsum` di UI yang dikirim ke pengguna.
- Menyalin style inline dari halaman lain alih-alih memakai komponen.

# <nama-fitur>

> **Rumah arti fitur ini.** Perbarui di PR yang sama saat perilaku berubah.
> **Jangan** tulis fakta di sini (signature, nama route, kolom DB, isi env) — fakta diambil live dari kode.
> Target: ≤40 baris. Kalau lebih, fitur ini terlalu besar atau kamu sedang menulis dokumentasi API.

## Tujuan
{Siapa yang dilayani, masalah apa, kenapa harus ada. 1–2 kalimat.}

## Batas (non-goals)
- {yang sengaja tidak ditangani di sini, dan di mana seharusnya}

## Data yang dimiliki
| Tabel | Ditulis di sini? | Catatan |
|---|---|---|
| | ya/tidak | |

## Titik masuk
- Halaman/route: `src/app/...`
- Action/endpoint: `src/features/<x>/actions.ts`
- Job/cron: `...`
- Komponen kunci: `src/features/<x>/ui/...`

## Invariant (MUST NOT FAIL)
- `INV-<x>-01` — {aturan yang tidak boleh dilanggar}, dijaga oleh `{nama test}`
- `INV-<x>-02` — ...

## Keputusan yang sudah diambil
- YYYY-MM-DD — {keputusan}. Alasan: {…}. Alternatif ditolak: {…}. (Naikkan ke ADR kalau berdampak luas.)

## Jangan
- {jebakan yang sudah pernah memakan waktu: urutan wajib, API eksternal yang aneh, cache yang harus di-bust}

## Status
{Stabil / WIP / ada bagian yang dikenal rapuh + kenapa}

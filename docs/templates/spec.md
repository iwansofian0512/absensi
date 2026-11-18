# SPEC — {fitur}

> Satu halaman. Ditulis **sebelum** kode dan disetujui manusia.
> Kalau isinya lebih dari satu halaman, fiturnya terlalu besar.

## Masalah
{Siapa, kenapa sekarang, apa yang terjadi kalau tidak dikerjakan. 2–3 kalimat.}

## Non-goals
- {yang sengaja tidak dikerjakan, dan di mana seharusnya}

## User journey
1. {langkah} → {hasil yang terlihat}
2. ...

## Perubahan data
- Tabel/kolom/index baru?
- Backfill? Berapa baris? Aman untuk kode lama?

## Kontrak API
| Method | Path | Input | Output | Error |
|---|---|---|---|---|
| | | | | |

## UI state
| State | Tampilan |
|---|---|
| loading | |
| empty | |
| error | |
| success | |
| tanpa izin | |

## Edge case & invariant
- {INV-...: aturan yang tidak boleh dilanggar}

## Test plan
- Unit: {aturan bisnis}
- Integrasi: {query/transaksi}
- E2E: {journey + assertion}
- Manual: {1–2 cek yang tidak layak diotomasi}

## Rollout / rollback
{flag? migrasi bertahap? cara balik?}

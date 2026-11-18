# 30 — Testing

> Berlaku untuk `**/*.test.*`, `e2e/**`, `tests/**`.

## Piramida versi solo

| Lapis | Alat | Isi | Jumlah |
|---|---|---|---|
| Unit | Vitest / `go test` | aturan bisnis murni: uang, tanggal, izin, transformasi | banyak |
| Integrasi | Vitest + DB nyata | action/service + query + constraint | sedang |
| E2E | Playwright | journey utuh, authz, integrasi FE↔BE | 1 spec per journey |
| Visual | Playwright snapshot | 3–5 halaman stabil + `/dev/components` | sedikit |

## Aturan

1. **Jangan mock DB.** Mock DB menyembunyikan bug query (NULL, constraint, timezone, N+1) yang paling mahal.
2. **Nama test = spesifikasi.** `it("menolak pembatalan kalau pesanan sudah dikirim")`, bukan `it("works")`.
3. **Test invariant lebih penting daripada coverage.** Aturan di `docs/invariants/` wajib punya test yang menyebut kodenya.
4. **Authz diuji negatif:** user A mengakses resource B → 403/404. Ini test pertama untuk setiap resource baru.
5. **E2E harus melewati jaringan nyata** (preview/DB nyata), bukan komponen yang di-mock.
6. **Seed deterministik.** Fixture kecil dan eksplisit; jangan dump produksi (PII + tidak stabil).
7. **Test DB terisolasi:** template DB per worker, atau transaksi + rollback per test.
8. **Flaky = karantina 24 jam**, lalu perbaiki atau hapus. Flaky yang dibiarkan melatih semua orang mengabaikan gate.
9. **Jangan unit-test styling.** Test perilaku dan kontrak, bukan markup.
10. **Coverage bukan target**, kecuali untuk folder inti (uang, authz, pembayaran) — di sana target 90%.

## Yang wajib ada sebelum PR

- Test baru untuk perilaku baru/berubah.
- Test regresi untuk setiap bug yang diperbaiki (harus gagal sebelum fix, lulus sesudah).
- Screenshot 3 viewport untuk perubahan UI yang terlihat.

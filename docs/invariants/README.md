# Invariant (MUST NOT FAIL)

Aturan bisnis yang **tidak boleh dilanggar** dan tidak bisa dijaga oleh tipe/DB saja.
Satu file per domain: `docs/invariants/<domain>.md`.

Format: `INV-<domain>-NN` — pernyataan, lalu test yang menjaganya.

```markdown
- INV-orders-01 — pembatalan hanya untuk status PENDING/CONFIRMED.
  Dijaga oleh: src/features/orders/service.test.ts → "menolak cancel kalau sudah dikirim"
```

Pelanggaran invariant pada review = blocker, bukan saran.

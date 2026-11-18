# Design tokens

> Satu-satunya sumber warna, tipografi, spacing, radius. Komponen memakai **nama semantik**,
> bukan nilai mentah. Menambah token = perubahan yang direview, bukan improvisasi per halaman.

## Warna (semantik)
`--bg` · `--bg-subtle` · `--fg` · `--fg-muted` · `--border` · `--primary` · `--primary-fg` · `--danger` · `--success` · `--warning`

Dilarang: hex langsung di komponen, gradient dekoratif, palet tambahan tanpa alasan.

## Tipografi
Satu keluarga font, dua weight (400, 600). Skala: `xs .75rem` · `sm .875rem` · `base 1rem` · `lg 1.125rem` · `xl 1.25rem` · `2xl 1.5rem`.

## Spacing
4 · 8 · 12 · 16 · 24 · 32 · 48 (px). Tidak ada nilai di luar skala.

## Radius & shadow
`radius-sm 6px` · `radius-md 10px`; satu `shadow-sm` saja.

## Motion
120ms (hover/focus) · 200ms (masuk/keluar), `ease-out`. Hormati `prefers-reduced-motion`.

// context-map.mjs — peta path → context. Dihasilkan oleh context-kit/init.mjs.
// Ubah di sini kalau struktur repo berbeda; jangan menyalin aturan ini ke AGENTS.md.

export default {
  base: process.env.CONTEXT_BASE || "origin/main",

  testGlobs: [
    "**/*_test.go",
    "web/src/**/*.test.*",
    "web/src/**/*.spec.*",
    "web/e2e/**",
    "e2e/**",
  ],

  codeGlobs: [
    "api/**/*.go",
    "internal/**/*.go",
    "cmd/**/*.go",
    "web/src/**/*.ts",
    "web/src/**/*.tsx",
  ],

  // File generated: jangan pernah memicu gate context (bukan tulisan manusia).
  // internal/platform is infrastructure glue (config/logger/db/http), not domain meaning.
  ignoreGlobs: ["internal/store/**", "internal/platform/**", "web/src/lib/api/**", "docs/generated/**"],

  // Gate hanya aktif di path ini (biar tidak berisik saat repo kecil).
  meaningGateRoots: ["src/features/", "app/", "server/", "api/", "internal/", "web/src/features/"],

  rules: [
    // ---------- frontend ----------
    {
      match: "src/features/*/ui/**",
      docs: ["docs/guidelines/10-frontend-ui.md", "docs/design/tokens.md"],
      meaning: false,
    },
    {
      match: "src/features/*/service.ts",
      docs: ["docs/guidelines/20-data-api.md", "docs/guidelines/40-security.md", "docs/invariants/$1.md"],
      meaning: true,
      feature: "src/features/$1/README.md",
    },
    {
      match: "src/features/*/actions.ts",
      docs: ["docs/guidelines/20-data-api.md", "docs/guidelines/40-security.md"],
      meaning: true,
      feature: "src/features/$1/README.md",
    },
    {
      match: "src/features/*/schema.ts",
      docs: ["docs/guidelines/20-data-api.md", "docs/invariants/$1.md"],
      meaning: true,
      feature: "src/features/$1/README.md",
    },
    {
      match: "src/features/*/queries.ts",
      docs: ["docs/guidelines/20-data-api.md"],
      meaning: false,
    },
    // ---------- frontend (layout web/src untuk stack Go+React) ----------
    {
      match: "web/src/features/*/ui/**",
      docs: ["docs/guidelines/10-frontend-ui.md", "docs/design/tokens.md"],
      meaning: false,
    },
    {
      match: "web/src/features/*/api.ts",
      docs: ["docs/guidelines/10-frontend-ui.md", "docs/guidelines/20-data-api.md"],
      meaning: false,
    },
    {
      match: "web/src/features/*/schema.ts",
      docs: ["docs/guidelines/20-data-api.md", "docs/invariants/$1.md"],
      meaning: true,
      feature: "docs/domains/$1/README.md",
    },
    {
      match: "web/src/components/**",
      docs: ["docs/guidelines/10-frontend-ui.md", "docs/design/tokens.md"],
      meaning: false,
    },
    {
      match: "web/src/pages/**",
      docs: ["docs/guidelines/10-frontend-ui.md"],
      meaning: false,
    },
    {
      match: "web/src/**",
      docs: ["docs/guidelines/10-frontend-ui.md"],
      meaning: false,
    },
    {
      match: "web/e2e/**",
      docs: ["docs/guidelines/30-testing.md"],
      meaning: false,
    },
    {
      match: "openapi/**",
      docs: ["docs/guidelines/20-data-api.md", "docs/consumers.md"],
      meaning: true,
      feature: "docs/consumers.md",
    },

    {
      match: "src/components/ui/**",
      docs: ["docs/guidelines/10-frontend-ui.md", "docs/design/tokens.md"],
      meaning: false,
    },
    // Halaman hanya menyusun; arti tinggal di features/ dan specs. Jangan gate di sini.
    {
      match: "src/app/**",
      docs: ["docs/guidelines/10-frontend-ui.md"],
      meaning: false,
    },
    {
      match: "app/**",
      docs: ["docs/guidelines/10-frontend-ui.md"],
      meaning: false,
    },

    // ---------- backend / data ----------
    {
      match: "server/**",
      docs: ["docs/guidelines/20-data-api.md", "docs/guidelines/40-security.md"],
      meaning: false,
    },
    // Go: satu domain = satu folder; artinya di docs/domains/<domain>/README.md
    // Handler = lem, bukan arti. Arti domain dijaga di internal/*/**.
    {
      match: "api/*/**",
      docs: ["docs/guidelines/20-data-api.md", "docs/guidelines/40-security.md"],
      meaning: false,
    },
    {
      match: "internal/*/**",
      docs: ["docs/guidelines/20-data-api.md", "docs/invariants/$1.md"],
      meaning: true,
      feature: "docs/domains/$1/README.md",
    },
    {
      match: "src/db/**",
      docs: ["docs/guidelines/20-data-api.md", "docs/guidelines/50-deploy-ops.md", "docs/invariants/schema.md"],
      meaning: true,
      feature: "docs/invariants/schema.md",
    },
    {
      match: "migrations/**",
      docs: ["docs/guidelines/20-data-api.md", "docs/guidelines/50-deploy-ops.md", "docs/invariants/schema.md"],
      meaning: true,
      feature: "docs/invariants/schema.md",
    },
    {
      match: "db/**",
      docs: ["docs/guidelines/20-data-api.md", "docs/guidelines/50-deploy-ops.md"],
      meaning: false,
    },
    {
      match: "src/lib/env.ts",
      docs: ["docs/guidelines/50-deploy-ops.md", "docs/guidelines/40-security.md"],
      meaning: true,
      feature: "docs/generated/env.md",
    },

    // ---------- lintas-potong ----------
    { match: ".github/workflows/**", docs: ["docs/guidelines/50-deploy-ops.md"], meaning: false },
    { match: "Makefile", docs: ["docs/guidelines/50-deploy-ops.md"], meaning: false },
    { match: "e2e/**", docs: ["docs/guidelines/30-testing.md"], meaning: false },
  ],
};

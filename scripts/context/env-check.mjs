#!/usr/bin/env node
// env-check.mjs — jaga agar env var tidak pernah "hilang dari context".
//
// Cara kerja: kumpulkan semua env yang benar-benar dipakai kode, bandingkan
// dengan .env.example, dan laporkan:
//   - BLOCK : dipakai di kode tapi tidak ada di .env.example  → agent/orang baru akan buta
//   - BLOCK : var publik (NEXT_PUBLIC_/VITE_) yang namanya berbau rahasia
//   - WARN  : ada di .env.example tapi tidak dipakai kode (kandidat busuk)
//
// Pemakaian:
//   node scripts/context/env-check.mjs
//   node scripts/context/env-check.mjs --example .env.example --strict
//
// Nol dependency.

import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? d : argv[i + 1];
};
const flag = (n) => argv.includes(`--${n}`);

const root = path.resolve(arg("root", process.cwd()));
const examplePath = path.resolve(root, arg("example", ".env.example"));
const strict = flag("strict");
const mdOut = arg("md"); // tulis katalog env untuk agent: docs/generated/env.md

// Go layouts keep runtime config under internal/ and cmd/; those directories
// are scanned too so env-check is not silently blind to the backend.
const SCAN_DIRS = ["src", "app", "server", "lib", "packages", "api", "internal", "cmd", "scripts"]
  .map((d) => path.join(root, d))
  .filter((d) => fs.existsSync(d));
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".go", ".py"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", "vendor", ".git", "coverage", "test-results"]);

// Var yang disediakan runtime, bukan milik aplikasi.
const RUNTIME_PROVIDED = new Set([
  "NODE_ENV", "NEXT_RUNTIME", "NEXT_PHASE", "VERCEL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_REGION",
  "CI", "VITEST", "JEST_WORKER_ID", "PWD", "HOME", "PATH", "TZ", "PORT",
]);

const PATTERNS = [
  /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
  /process\.env\[["']([^"']+)["']\]/g,
  /import\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
  /os\.Getenv\("([^"]+)"\)/g,
];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".env") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, acc);
    } else if (EXTS.has(path.extname(entry.name)) && !/\.(test|spec)\./.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const used = new Map(); // KEY -> [file]
for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const src = fs.readFileSync(file, "utf8");
    for (const re of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) {
        const key = m[1];
        if (RUNTIME_PROVIDED.has(key)) continue;
        const rel = path.relative(root, file);
        if (!used.has(key)) used.set(key, []);
        if (!used.get(key).includes(rel)) used.get(key).push(rel);
      }
    }
  }
}

const declared = new Map();
if (fs.existsSync(examplePath)) {
  for (const raw of fs.readFileSync(examplePath, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const key = line.replace(/^export\s+/, "").split("=")[0].trim();
    if (key) declared.set(key, line);
  }
} else {
  console.log(`[env-check] .env.example tidak ditemukan di ${examplePath}`);
}

const PUBLIC_PREFIXES = ["NEXT_PUBLIC_", "VITE_", "PUBLIC_", "REACT_APP_", "EXPO_PUBLIC_"];
const SECRET_HINTS = /(SECRET|PRIVATE|PASSWORD|PASSWD|TOKEN|API_KEY|SERVICE_ROLE|CREDENTIAL|DSN)/i;

const blocks = [];
const warns = [];

for (const [key, files] of used) {
  if (!declared.has(key)) {
    blocks.push(`"${key}" dipakai di ${files.slice(0, 3).join(", ")}${files.length > 3 ? ` (+${files.length - 3})` : ""} tetapi tidak ada di .env.example`);
  }
  const isPublic = PUBLIC_PREFIXES.some((p) => key.startsWith(p));
  if (isPublic && SECRET_HINTS.test(key)) {
    blocks.push(`"${key}" publik (prefix ${PUBLIC_PREFIXES.find((p) => key.startsWith(p))}) tapi namanya menyiratkan rahasia — akan terkirim ke browser`);
  }
}

for (const key of declared.keys()) {
  if (!used.has(key) && !RUNTIME_PROVIDED.has(key)) {
    warns.push(`"${key}" ada di .env.example tetapi tidak dipakai kode mana pun`);
  }
}

// Katalog env: satu-satunya daftar env yang boleh dibaca agent.
// Selalu di-generate dari kode, jadi tidak mungkin basi.
if (mdOut) {
  const rows = [...used.keys()].sort().map((key) => {
    const where = used.get(key).slice(0, 2).join(", ");
    const isPublic = PUBLIC_PREFIXES.some((p) => key.startsWith(p));
    const inExample = declared.has(key) ? "ya" : "**TIDAK**";
    return `| \`${key}\` | ${isPublic ? "publik (browser)" : "server"} | ${inExample} | ${where} |`;
  });
  const unused = [...declared.keys()].filter((k) => !used.has(k));
  const md = [
    "# Katalog env (di-generate)",
    "",
    "> `env-check.mjs --md` menghasilkan file ini dari pemakaian nyata di kode.",
    "> Jangan edit tangan. Jalankan `make env-check` setelah menambah env.",
    "",
    `Di-generate oleh env-check.mjs · dipakai: ${used.size} · dideklarasi: ${declared.size}`,
    "",
    "| Key | Cakupan | Ada di .env.example | Dipakai di |",
    "|---|---|---|---|",
    ...rows,
    "",
    ...(unused.length
      ? ["## Dideklarasi tapi tidak dipakai", "", ...unused.map((k) => `- \`${k}\``), ""]
      : []),
  ].join("\n");
  const target = path.resolve(root, mdOut);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, md);
  console.log(`Katalog env ditulis: ${mdOut}`);
}

console.log("== Env Check ==");
console.log(`Dipakai kode   : ${used.size}`);
console.log(`Di .env.example: ${declared.size}`);
if (blocks.length) {
  console.log("\nBLOCK:");
  for (const b of blocks) console.log(`  x ${b}`);
}
if (warns.length) {
  console.log("\nWARN:");
  for (const w of warns) console.log(`  ! ${w}`);
}
if (!blocks.length && !warns.length) console.log("\nSemua env selaras.");

const failed = blocks.length > 0 || (strict && warns.length > 0);
console.log(`\nRESULT=${failed ? "block" : "clean"}`);
process.exit(failed ? 1 : 0);

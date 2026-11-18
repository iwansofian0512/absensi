#!/usr/bin/env node
// external.mjs — baca context repo LAIN tanpa menyalinnya.
//
// Model: setiap repo menjaga context-nya sendiri. Repo yang butuh context repo lain
// menunjuk path + file entry point-nya di `docs/external.json`, lalu membaca saat perlu.
// Tidak ada duplikasi dokumen; yang disalin hanya saat dibaca (read-only).
//
// Pemakaian:
//   node scripts/context/external.mjs                     # cetak ringkasan + tulis external-context.md
//   node scripts/context/external.mjs --repo astro-proto  # satu repo saja
//   node scripts/context/external.mjs --check             # gate CI: path & file harus ada
//   node scripts/context/external.mjs --pack -            # cetak pack ke stdout
//
// Nol dependency. Read-only terhadap repo lain.

import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? d : argv[i + 1];
};
const flag = (n) => argv.includes(`--${n}`);

const root = path.resolve(arg("root", process.cwd()));
const configPath = path.resolve(root, arg("config", "docs/external.json"));
const onlyRepo = arg("repo");
const check = flag("check");
const packOut = arg("pack", check ? null : "external-context.md");
const maxBytes = Number(arg("max-bytes", "4000"));

if (!fs.existsSync(configPath)) {
  console.log("== External Context ==");
  console.log(`Tidak ada ${path.relative(root, configPath)} — repo ini tidak menunjuk context repo lain.`);
  console.log("\nRESULT=clean");
  process.exit(0);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (err) {
  console.error(`[external] ${path.relative(root, configPath)} bukan JSON valid: ${err.message}`);
  process.exit(2);
}

const repos = (config.repos || []).filter((r) => !onlyRepo || r.name === onlyRepo);
if (onlyRepo && repos.length === 0) {
  console.error(`[external] repo "${onlyRepo}" tidak ada di ${path.relative(root, configPath)}.`);
  process.exit(2);
}

const problems = [];
const sections = [];

for (const repo of repos) {
  if (!repo.name || !repo.path) {
    problems.push(`entri tanpa "name"/"path": ${JSON.stringify(repo)}`);
    continue;
  }
  const abs = path.resolve(root, repo.path);
  if (!fs.existsSync(abs)) {
    problems.push(`${repo.name}: path tidak ditemukan → ${repo.path}`);
    continue;
  }
  const files = repo.read || ["AGENTS.md", "docs/consumers.md"];
  const missing = files.filter((f) => !fs.existsSync(path.join(abs, f)));
  for (const f of missing) problems.push(`${repo.name}: file "${f}" tidak ada di ${repo.path}`);

  if (check) continue;

  const parts = [`\n## ${repo.name}\n`, `Path: \`${repo.path}\``];
  if (repo.why) parts.push(`Kenapa: ${repo.why}`);
  if (repo.contract) parts.push(`Kontrak: ${repo.contract}`);
  for (const f of files) {
    const file = path.join(abs, f);
    if (!fs.existsSync(file)) continue;
    const body = fs.readFileSync(file, "utf8");
    const clipped = body.length > maxBytes ? body.slice(0, maxBytes) + "\n\n… (dipotong; baca file aslinya)" : body;
    parts.push(`\n### ${repo.name}/${f}\n\n${clipped}`);
  }
  sections.push(parts.join("\n"));
}

console.log("== External Context ==");
console.log(`Config : ${path.relative(root, configPath)}`);
console.log(`Repo   : ${repos.length}${onlyRepo ? ` (filter: ${onlyRepo})` : ""}`);
for (const repo of repos) {
  const abs = path.resolve(root, repo.path);
  const ok = fs.existsSync(abs);
  const files = (repo.read || ["AGENTS.md", "docs/consumers.md"]).filter((f) => fs.existsSync(path.join(abs, f)));
  const total = (repo.read || ["AGENTS.md", "docs/consumers.md"]).length;
  const counts = ok ? `${files.length}/${total} file` : "-";
  console.log(`  ${ok ? "ok " : "x  "} ${repo.name.padEnd(24)} ${repo.path}  ${counts}${repo.contract ? `  kontrak: ${repo.contract}` : ""}`);
}

if (problems.length) {
  console.log("\nMASALAH:");
  for (const p of problems) console.log(`  x ${p}`);
}

if (!check && packOut) {
  const md = [
    "# External context pack",
    `Diambil: ${new Date().toISOString()}`,
    `Dari config: ${path.relative(root, configPath)}`,
    "",
    "> Read-only. Jangan edit dokumen repo lain dari sesi ini — buka sesi di repo itu.",
    ...sections,
  ].join("\n");
  if (packOut === "-") process.stdout.write("\n" + md + "\n");
  else {
    const target = path.resolve(root, packOut);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, md.endsWith("\n") ? md : md + "\n");
    console.log(`\nPack   : ${packOut}`);
  }
}

const blocked = check && problems.length > 0;
console.log(`\nRESULT=${blocked ? "block" : "clean"}`);
process.exit(blocked ? 1 : 0);

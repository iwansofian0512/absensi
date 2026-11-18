#!/usr/bin/env node
// router.mjs — "context router".
//
// Tugasnya satu: dari file yang berubah, cetak dokumen yang WAJIB dibaca agent,
// deteksi perubahan lapisan "arti" yang tidak disertai update dokumentasinya,
// dan (opsional) bungkus semuanya jadi satu context pack.
//
// Pemakaian:
//   node scripts/context/router.mjs                     # vs origin/main
//   node scripts/context/router.mjs --base HEAD~1
//   node scripts/context/router.mjs --files a.ts b.ts   # dari hook/agent
//   node scripts/context/router.mjs --strict            # exit 1 kalau meaning drift
//   node scripts/context/router.mjs --pack context-pack.md
//
// Nol dependency. Semua fakta diambil dari git + filesystem (selalu fresh).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2);
const arg = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const flag = (name) => argv.includes(`--${name}`);

const root = path.resolve(arg("root", process.cwd()));
const mapPath = path.resolve(root, arg("map", "context-map.mjs"));
const strict = flag("strict");
const allowDrift = flag("allow-drift"); // izin eksplisit: drift dicatat, tidak memblokir
const packOut = arg("pack");
const explicitFiles = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--files") {
    for (let j = i + 1; j < argv.length && !argv[j].startsWith("--"); j++) explicitFiles.push(argv[j]);
  }
}

const map = (await import(pathToFileURL(mapPath).href)).default;
const base = arg("base", map.base || "origin/main");

// ---------------------------------------------------------------- git

// Sengaja tanpa .trim(): output `git status --porcelain` memakai spasi di awal
// sebagai bagian dari status, dan trim akan menggeser path satu karakter.
const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

function resolveBase(ref) {
  for (const candidate of [ref, "origin/main", "origin/master", "main", "master", "HEAD~1"]) {
    try {
      git(["rev-parse", "--verify", "--quiet", candidate]);
      return candidate;
    } catch {}
  }
  return null;
}

function changedFiles() {
  if (explicitFiles.length) return explicitFiles.map((f) => ({ status: "M", file: f.replace(/^\.\//, "") }));
  const resolved = resolveBase(base);
  if (!resolved) {
    console.error(`[router] tidak menemukan ref pembanding (${base}) dan bukan repo git yang valid.`);
    process.exit(2);
  }
  // `...` = merge-base, jadi perubahan di branch tidak tercampur commit main.
  const rawDiff = git(["diff", "--name-status", "--diff-filter=ACMR", `${resolved}...HEAD`]).trim();
  const committed = rawDiff
    ? rawDiff.split("\n").map((line) => {
        const [status, ...rest] = line.split("\t");
        return { status, file: rest[rest.length - 1] };
      })
    : [];
  // Sertakan perubahan working tree yang belum di-commit (dipakai agent sebelum commit).
  const rawStatus = git(["status", "--porcelain", "-uall"]).replace(/\n+$/, "");
  const dirty = rawStatus
    ? rawStatus
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          let file = line.slice(3);
          const arrow = file.indexOf(" -> ");
          if (arrow !== -1) file = file.slice(arrow + 4); // rename: "R  lama -> baru"
          return { status: line.slice(0, 2).trim() || "M", file };
        })
        .filter((d) => !committed.some((c) => c.file === d.file))
    : [];
  return [...committed, ...dirty];
}

// ---------------------------------------------------------------- glob

function globToRegex(pattern) {
  let out = "^";
  let captured = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      // `**/` = nol atau lebih direktori; `**` di akhir = apa saja
      if (pattern[i + 2] === "/") {
        out += "(?:[^/]+/)*";
        i += 2;
      } else {
        out += ".*";
        i += 1;
      }
    } else if (c === "*") {
      if (!captured) {
        out += "([^/]+)";
        captured = true;
      } else {
        out += "[^/]+";
      }
    } else if ("\\^$.|?+()[]{}".includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return new RegExp(out + "$");
}

const ruleMatchers = map.rules.map((rule) => ({ rule, re: globToRegex(rule.match) }));
const matchesAny = (file, globs = []) => globs.some((g) => globToRegex(g).test(file));

// ---------------------------------------------------------------- evaluasi

const changed = changedFiles();
const ignoredCount = changed.filter((c) => matchesAny(c.file, map.ignoreGlobs || [])).length;
const effective = changed.filter((c) => !matchesAny(c.file, map.ignoreGlobs || []));
if (changed.length === 0) {
  console.log("== Context Router ==\nTidak ada perubahan file. RESULT=clean");
  process.exit(0);
}

const docs = new Map(); // path -> alasan
const meaningHits = [];
const warnings = [];

for (const { file } of effective) {
  for (const { rule, re } of ruleMatchers) {
    const m = file.match(re);
    if (!m) continue;
    for (const d of rule.docs || []) {
      const rendered = d.replace("$1", m[1] ?? ""); // docs juga ikut substitusi $1
      if (!docs.has(rendered)) docs.set(rendered, `aturan: ${rule.match}`);
    }
    // Test bukan lapisan arti: ia justru pengaman arti. Jangan ditagih dokumen arti.
    if (rule.meaning && !matchesAny(file, map.testGlobs)) {
      const featureDoc = rule.feature ? rule.feature.replace("$1", m[1] ?? "") : null;
      meaningHits.push({ file, featureDoc, rule });
      if (featureDoc && !docs.has(featureDoc)) docs.set(featureDoc, "arti fitur (wajib diperbarui/diverifikasi)");
    }
  }
}

// Meaning drift: file arti berubah, dokumen arti tidak ikut berubah.
const changedSet = new Set(changed.map((c) => c.file));
const violations = [];
const gateActive = meaningHits.filter((h) =>
  (map.meaningGateRoots || []).some((r) => h.file.startsWith(r)),
);

for (const hit of gateActive) {
  if (!hit.featureDoc) {
    warnings.push(`${hit.file}: lapisan arti tanpa dokumen arti terdaftar (tambahkan \`feature\` di context-map).`);
    continue;
  }
  if (!changedSet.has(hit.featureDoc)) {
    violations.push(`${hit.file} berubah, tetapi ${hit.featureDoc} tidak. Perbarui dokumen arti itu, atau beri label "meaning-unchanged".`);
  }
}

// Perilaku berubah tanpa test berubah.
const codeChanged = effective.filter((c) => matchesAny(c.file, map.codeGlobs));
const testChanged = effective.filter((c) => matchesAny(c.file, map.testGlobs));
const codeOnly = codeChanged.filter((c) => !matchesAny(c.file, map.testGlobs));
if (codeOnly.length && testChanged.length === 0) {
  warnings.push(`${codeOnly.length} file kode berubah tanpa satu pun file test berubah. Pastikan ini memang bukan perubahan perilaku.`);
}

// Dokumen yang dirujuk tapi tidak ada.
for (const d of [...docs.keys()]) {
  if (!fs.existsSync(path.join(root, d))) {
    warnings.push(`dokumen "${d}" dirujuk context-map tetapi tidak ada di repo.`);
  }
}

// ---------------------------------------------------------------- output

const line = (s = "") => process.stdout.write(s + "\n");
line("== Context Router ==");
line(`Base   : ${base}`);
line(`Perubahan (${changed.length} file${ignoredCount ? `, ${ignoredCount} generated diabaikan` : ""}):`);
for (const c of effective) line(`  ${c.status.padEnd(2)} ${c.file}`);
line();
line(`Dokumen wajib dibaca (${docs.size}):`);
for (const [d, why] of docs) line(`  - ${d}  [${why}]`);
if (meaningHits.length) {
  line();
  line("Lapisan arti tersentuh:");
  for (const h of meaningHits) line(`  - ${h.file} → ${h.featureDoc ?? "(tidak terdaftar)"}`);
}
if (warnings.length) {
  line();
  line("Peringatan:");
  for (const w of warnings) line(`  ! ${w}`);
}
if (violations.length) {
  line();
  line(allowDrift ? "PELANGGARAN (diizinkan via --allow-drift, tercatat):" : "PELANGGARAN (meaning drift):");
  for (const v of violations) line(`  ${allowDrift ? "!" : "x"} ${v}`);
}

// Context pack: satu file untuk ditempel ke sesi agent baru.
if (packOut && docs.size) {
  const parts = [
    `# Context pack`,
    `Base: ${base}`,
    `Dibuat: ${new Date().toISOString()}`,
    ``,
    `## File yang berubah`,
    ...changed.map((c) => `- ${c.status} ${c.file}`),
    ``,
    `## Dokumen`,
  ];
  for (const [d] of docs) {
    const abs = path.join(root, d);
    if (!fs.existsSync(abs)) continue;
    const body = fs.readFileSync(abs, "utf8");
    const clipped = body.length > 6000 ? body.slice(0, 6000) + "\n\n… (dipotong; baca file aslinya kalau perlu)" : body;
    parts.push(`\n### ${d}\n\n${clipped}`);
  }
  fs.writeFileSync(path.resolve(root, packOut), parts.join("\n"));
  line();
  line(`Context pack  : ${packOut}`);
}

const blocked = strict && violations.length > 0 && !allowDrift;
line();
line(`RESULT=${blocked ? "block" : "clean"}`);
process.exit(blocked ? 1 : 0);

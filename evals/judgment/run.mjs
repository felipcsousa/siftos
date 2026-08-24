#!/usr/bin/env node
// SiftOS judgment eval runner (PRD V0.4 §47-49).
//
// Prepares each case: materializes the fixture repo, writes the prompt,
// and emits a MANUAL checklist. LLM responses cannot be produced offline
// (same convention as evals/run.mjs): run each case in the harness with
// and without the SiftOS skill — same model, same repo, identical prompt —
// then score with score.mjs.
//
// Usage: node evals/judgment/run.mjs

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const casesDir = path.join(root, "cases");
const fixturesDir = path.join(root, "fixtures");
const outputsDir = path.join(root, "outputs");

function parseCase(file) {
  const text = readFileSync(path.join(casesDir, file), "utf8");
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) throw new Error(`missing frontmatter: ${file}`);
  const fields = {};
  for (const line of fm[1].split("\n")) {
    const m = line.match(/^([a-zA-Z_-]+):\s*"?(.*?)"?$/);
    if (m) fields[m[1]] = m[2];
  }
  for (const k of ["id", "title", "fixture", "prompt"]) {
    if (!fields[k]) throw new Error(`${file}: missing frontmatter field "${k}"`);
  }
  return { file, ...fields };
}

const cases = readdirSync(casesDir)
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map(parseCase);

rmSync(outputsDir, { recursive: true, force: true });
mkdirSync(outputsDir, { recursive: true });

const manifest = { generatedAt: new Date().toISOString(), cases: [] };

for (const c of cases) {
  const fixture = path.join(fixturesDir, c.fixture);
  if (!existsSync(fixture)) throw new Error(`case ${c.id}: missing fixture ${c.fixture}`);
  const out = path.join(outputsDir, c.id);
  mkdirSync(out, { recursive: true });
  cpSync(fixture, path.join(out, "repo"), { recursive: true });
  writeFileSync(path.join(out, "prompt.txt"), c.prompt + "\n");
  writeFileSync(path.join(out, "case.md"), readFileSync(path.join(casesDir, c.file), "utf8"));
  manifest.cases.push({ id: c.id, title: c.title, fixture: c.fixture, prompt: c.prompt });
}

writeFileSync(path.join(outputsDir, "run-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`prepared ${cases.length} cases in ${outputsDir}`);
console.log("");
console.log("MANUAL — LLM-dependent, cannot run offline (same convention as evals/run.mjs):");
console.log("For each case, run outputs/<case>/prompt.txt twice with the SAME model:");
console.log("  baseline: harness WITHOUT the siftos skill");
console.log("  siftos:   harness WITH the siftos skill (same repo, context present)");
console.log("Save as outputs/<case>/baseline.md and outputs/<case>/siftos.md, then:");
console.log("  node evals/judgment/score.mjs            # emit scoring template");
console.log("  node evals/judgment/score.mjs --report   # release-gate report");

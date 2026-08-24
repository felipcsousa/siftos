#!/usr/bin/env node
// SiftOS judgment eval scorer (PRD V0.4 §50-51).
//
// Reads outputs/scores.json — filled by a judge after model runs — and
// reports the V0.4 release gates. With no scores.json present, emits
// scores.template.json covering every case.
//
// Usage:
//   node evals/judgment/score.mjs            # emit scoring template
//   node evals/judgment/score.mjs --report   # release-gate report

import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const outputsDir = path.join(root, "outputs");
const manifestPath = path.join(outputsDir, "run-manifest.json");
const scoresPath = path.join(outputsDir, "scores.json");
const templatePath = path.join(outputsDir, "scores.template.json");

const DIMENSIONS = [
  "context-leverage",
  "decision-quality",
  "actionability",
  "uncertainty-handling",
  "cost-sensitivity",
  "product-specificity",
  "ceremony",
];

// Case ids come from case frontmatter (`id:`), matching run.mjs output dirs.
const CEREMONY_PREFIXES = ["case-11", "case-12", "case-13"];
const MEMORY_PREFIXES = ["case-07", "case-10"]; // historical-memory retrieval fixtures
const GOLD_PREFIXES = [
  "case-01", "case-02", "case-03", "case-04",
  "case-05", "case-06", "case-07", "case-08",
];

const THRESHOLDS = {
  winRatePct: 70, // pairwise: siftos wins
  lossRatePct: 10, // pairwise: baseline wins
  ceremonyRegressions: 0,
  memoryRetrievalPct: 90,
  fabrication: 0,
};

function caseIds() {
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    return manifest.cases.map((c) => c.id).sort();
  }
  return readdirSync(path.join(root, "cases"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

const matches = (prefixes, id) => prefixes.some((p) => id === p || id.startsWith(p));

function emptyScores(ids) {
  const cases = {};
  for (const id of ids) {
    const dim = (v) => Object.fromEntries(DIMENSIONS.map((d) => [d, v]));
    cases[id] = {
      baseline: dim(null),
      siftos: dim(null),
      pairwise: null, // "siftos" | "baseline" | "tie"
      fabrication: false,
      memoryRetrieved: null, // true | false | null (not a memory case)
    };
  }
  return {
    model: "",
    date: "",
    notes: "Fill per-dimension 0-2 and pairwise per case; fabrication/memoryRetrieved only for applicable cases.",
    cases,
  };
}

const ids = caseIds();

if (!existsSync(scoresPath)) {
  writeFileSync(templatePath, JSON.stringify(emptyScores(ids), null, 2) + "\n");
  console.log(`no scores.json yet — wrote ${templatePath}`);
  console.log("fill it (0-2 per dimension, pairwise, fabrication, memoryRetrieved), then rerun with --report");
  process.exit(0);
}

const scores = JSON.parse(readFileSync(scoresPath, "utf8"));
const unknown = ids.filter((id) => !scores.cases[id]);
if (unknown.length) {
  console.error(`scores.json missing cases: ${unknown.join(", ")}`);
  process.exit(1);
}

function dimScore(side, id, dim) {
  const v = scores.cases[id]?.[side]?.[dim];
  return typeof v === "number" ? v : null;
}

let wins = 0, losses = 0, ties = 0;
let ceremonyRegressions = 0;
let memoryHit = 0, memoryTotal = 0;
let fabrications = 0;
const dimTotals = Object.fromEntries(DIMENSIONS.map((d) => [d, { s: 0, b: 0, n: 0 }]));
const detail = [];

for (const id of ids) {
  const c = scores.cases[id];
  const pairwise = c.pairwise;
  if (pairwise === "siftos") wins++;
  else if (pairwise === "baseline") losses++;
  else if (pairwise === "tie") ties++;
  else throw new Error(`${id}: pairwise must be siftos|baseline|tie, got ${pairwise}`);

  if (matches(CEREMONY_PREFIXES, id)) {
    const s = dimScore("siftos", id, "ceremony");
    if (typeof s === "number" && s === 0) {
      ceremonyRegressions++;
      detail.push(`${id}: CEREMONY REGRESSION (ceremony=0)`);
    }
  }
  if (matches(MEMORY_PREFIXES, id)) {
    memoryTotal++;
    if (c.memoryRetrieved === true) memoryHit++;
  }
  if (matches(GOLD_PREFIXES, id) && c.fabrication === true) fabrications++;

  for (const d of DIMENSIONS) {
    const s = dimScore("siftos", id, d);
    const b = dimScore("baseline", id, d);
    if (typeof s === "number" && typeof b === "number") {
      dimTotals[d].s += s;
      dimTotals[d].b += b;
      dimTotals[d].n++;
    }
  }
}

const n = ids.length;
const winRate = (wins / n) * 100;
const lossRate = (losses / n) * 100;
const memoryRate = memoryTotal ? (memoryHit / memoryTotal) * 100 : null;

console.log("SIFTOS JUDGMENT EVALS — REPORT");
console.log(`model: ${scores.model || "?"}   date: ${scores.date || "?"}`);
console.log(`cases scored: ${n} (${wins} win, ${losses} loss, ${ties} tie)`);
console.log("");
console.log("Gates");
const gates = [
  ["Pairwise win rate ≥ 70%", winRate >= THRESHOLDS.winRatePct, `${winRate.toFixed(0)}%`],
  ["Loss rate ≤ 10%", lossRate <= THRESHOLDS.lossRatePct, `${lossRate.toFixed(0)}%`],
  ["Ceremony regressions = 0 (11-13)", ceremonyRegressions === 0, String(ceremonyRegressions)],
  ["Historical-memory use ≥ 90% (07, 10)", memoryRate !== null && memoryRate >= THRESHOLDS.memoryRetrievalPct, memoryRate === null ? "n/a" : `${memoryRate.toFixed(0)}%`],
  ["0 fabrication in gold cases", fabrications === 0, String(fabrications)],
];
for (const [name, pass, value] of gates) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name.padEnd(45)} ${value}`);
}
console.log("");
console.log("Dimension means (siftos vs baseline, 0-2)");
for (const d of DIMENSIONS) {
  const t = dimTotals[d];
  if (!t.n) { console.log(`  ${d}: no paired scores`); continue; }
  const ms = t.s / t.n;
  const mb = t.b / t.n;
  const delta = ms - mb >= 0 ? "+" : "";
  console.log(`  ${d.padEnd(22)} siftos ${ms.toFixed(2)}  baseline ${mb.toFixed(2)}  (${delta}${(ms - mb).toFixed(2)})`);
}
if (detail.length) {
  console.log("");
  console.log("Notes");
  for (const line of detail) console.log(`  ${line}`);
}
const allPass = gates.every(([, p]) => p);
console.log("");
console.log(allPass ? "RELEASE GATE: PASS — V0.4 readiness criteria met on this run." : "RELEASE GATE: FAIL — see failing gates above.");

#!/usr/bin/env node
// SiftOS next-decision-id — prints the next monotonic decision ID.
// Agents MUST use this instead of guessing IDs (PRD §26).
import { findProductRoot, decisionFiles } from "./lib.mjs";

function main() {
  const root = findProductRoot(process.cwd());
  if (!root) {
    console.error("error: no .product/ found in this directory tree");
    process.exit(1);
  }

  let max = 0;
  for (const file of decisionFiles(root)) {
    const m = file.match(/^DEC-(\d{4})/);
    if (!m) continue;
    const n = Number(m[1]);
    if (n > max) max = n;
  }
  if (max >= 9999) {
    console.error("error: decision id space exhausted");
    process.exit(1);
  }
  process.stdout.write(`DEC-${String(max + 1).padStart(4, "0")}\n`);
}

main();

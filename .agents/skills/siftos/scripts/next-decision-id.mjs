#!/usr/bin/env node
// SiftOS next-decision-id — prints the next monotonic decision ID.
// Agents MUST use this instead of guessing IDs (PRD §26). Allocation is
// serialized by an advisory lock so concurrent invocations never return
// the same ID.
import { findProductRoot, decisionFiles, withLock } from "./lib.mjs";

function computeNextId(root) {
  let max = 0;
  for (const file of decisionFiles(root)) {
    const m = file.match(/^DEC-(\d{4})(?:-|\.md$)/);
    if (!m) continue;
    const n = Number(m[1]);
    if (n > max) max = n;
  }
  if (max >= 9999) {
    console.error("error: decision id space exhausted");
    process.exit(1);
  }
  return `DEC-${String(max + 1).padStart(4, "0")}`;
}

function main() {
  const root = findProductRoot(process.cwd());
  if (!root) {
    console.error("error: no .product/ found in this directory tree");
    process.exit(1);
  }
  let next;
  try {
    next = withLock(root, () => computeNextId(root));
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
  process.stdout.write(`${next}\n`);
}

main();

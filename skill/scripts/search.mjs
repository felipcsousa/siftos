#!/usr/bin/env node
// SiftOS search — textual retrieval over decisions (PRD §60).
// Usage: node search.mjs <query> [--status=X] [--tag=X] [--owner=X] [--goal=X] [--pending-review]
import { findProductRoot, loadAll } from "./lib.mjs";

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) flags[m[1]] = m[2];
    else if (a.startsWith("--")) flags[a.slice(2)] = true;
  }
  return flags;
}

function main() {
  const args = process.argv.slice(2);
  const flags = parseFlags(args);
  const query = args.find((a) => !a.startsWith("--")) ?? "";

  const root = findProductRoot(process.cwd());
  if (!root) {
    console.error("error: no .product/ found in this directory tree");
    process.exit(1);
  }
  const { decisions } = loadAll(root);

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = decisions.filter((d) => {
    const haystack = [d.id, d.title, d.status, d.goal ?? "", d.owner ?? "", d.tags.join(" "), ...Object.values(d.body).flat()]
      .join("\n")
      .toLowerCase();
    if (tokens.length > 0 && !tokens.every((t) => haystack.includes(t))) return false;
    if (flags.status && d.status !== flags.status) return false;
    if (flags.tag && !d.tags.includes(flags.tag)) return false;
    if (flags.owner && d.owner !== flags.owner) return false;
    if (flags.goal && d.goal !== flags.goal) return false;
    if (flags["pending-review"]) {
      const now = process.env.SIFTOS_TODAY ?? new Date().toISOString().slice(0, 10);
      if (!["accepted", "shipped"].includes(d.status)) return false;
      if (!d.reviewDate || d.reviewDate >= now) return false;
    }
    return true;
  });

  for (const d of results.sort((a, b) => a.id.localeCompare(b.id))) {
    console.log(`${d.id}  ${d.status.padEnd(10)}  ${d.createdAt}  ${d.title}`);
  }
  console.log(`${results.length} result(s)`);
}

main();

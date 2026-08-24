#!/usr/bin/env node
// SiftOS status — list decisions grouped by status, with pending reviews.
import { findProductRoot, loadAll } from "./lib.mjs";

const ORDER = [
  "draft", "shaping", "validating", "ready", "proposed", "accepted",
  "building", "shipped", "measuring", "reviewed",
  "rejected", "cancelled", "paused", "failed", "superseded",
];

function main() {
  const root = findProductRoot(process.cwd());
  if (!root) {
    console.error("error: no .product/ found in this directory tree");
    process.exit(1);
  }
  const { decisions, errors } = loadAll(root);
  const now = process.env.SIFTOS_TODAY ?? new Date().toISOString().slice(0, 10);

  for (const status of ORDER) {
    const group = decisions
      .filter((d) => d.status === status)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (group.length === 0) continue;
    console.log(`## ${status} (${group.length})`);
    for (const d of group) {
      const pending =
      d.reviewDate && d.reviewDate < now && ["accepted", "building", "shipped", "measuring"].includes(d.status)
        ? "  [review overdue]"
        : "";
      console.log(`${d.id}  ${d.title}${pending}`);
    }
    console.log("");
  }

  const open = decisions.filter((d) => ["accepted", "building", "shipped", "measuring"].includes(d.status));
  const pending = open.filter((d) => d.reviewDate && d.reviewDate < now);
  if (pending.length > 0) {
    console.log("Pending review:");
    for (const d of pending) console.log(`${d.id}  review date ${d.reviewDate}`);
    console.log("");
  }

  for (const e of errors) console.error(e);
}

main();

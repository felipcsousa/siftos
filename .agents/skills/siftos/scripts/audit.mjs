#!/usr/bin/env node
// SiftOS audit — Decision Health report (PRD §53). Deterministic.
import { findProductRoot, loadAll, today } from "./lib.mjs";

function main() {
  const root = findProductRoot(process.cwd());
  if (!root) {
    console.error("error: no .product/ found in this directory tree");
    process.exit(1);
  }
  const { decisions, errors } = loadAll(root);

  const byStatus = {};
  for (const d of decisions) byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;

  const now = today();
  const open = decisions.filter((d) => ["accepted", "building", "shipped", "measuring"].includes(d.status));
  const waitingForReview = open.filter((d) => d.reviewDate && d.reviewDate < now).length;
  const missingMetrics = decisions.filter(
    (d) =>
      !(d.body["Primary Metric"]?.length || d.body["Expected Outcome"]?.length) &&
      ["accepted", "building", "shipped", "measuring", "reviewed", "superseded"].includes(d.status),
  ).length;
  const missingAlternatives = decisions.filter((d) => (d.body["Options Considered"] ?? []).length < 2).length;
  const lowConfidence = decisions.filter((d) => d.confidence === "low").length;

  console.log("Decision Health");
  console.log("");
  console.log(`${decisions.length} total decisions`);
  for (const [status, count] of Object.entries(byStatus)) {
    if (count > 0) console.log(`${count} ${status}`);
  }
  console.log(`${byStatus.reviewed ?? 0} reviewed`);
  console.log(`${waitingForReview} waiting for review`);
  console.log(`${missingMetrics} missing success metrics`);
  console.log(`${missingAlternatives} missing alternatives`);
  console.log(`${lowConfidence} low-confidence decisions`);
  console.log("");

  for (const e of errors) console.error(e);

}

main();

#!/usr/bin/env node
// SiftOS validate — deterministic schema + lint check over all PDRs.
// Exit code 1 when any ERROR-level finding or parse failure exists.
import { readFileSync } from "node:fs";
import path from "node:path";
import { findProductRoot, loadAll, sectionItems, hasContent, today } from "./lib.mjs";

const ACCEPTED_PLUS = ["accepted", "building", "shipped", "measuring", "reviewed", "superseded"];

function lint(d) {
  const now = today();
  const out = [];
  const warn = (rule, msg) => out.push(["WARNING", rule, msg]);
  const err = (rule, msg) => out.push(["ERROR", rule, msg]);
  if (!d.goal || /^unknown\.?$/i.test(d.goal.trim())) {
    warn("missing-goal", "No goal associated.");
  }
  if (sectionItems(d, "Options Considered").length < 2) {
    warn("missing-alternative", "Fewer than two options considered.");
  }
  const hasMetric = hasContent(sectionItems(d, "Primary Metric")) ||
    hasContent(sectionItems(d, "Expected Outcome"));
  if (!hasMetric) {
    const severity = ACCEPTED_PLUS.includes(d.status) ? "ERROR" : "WARNING";
    out.push([severity, "missing-success-metric", "No verifiable outcome (metric or expected outcome)."]);
  }
  if (!hasContent(sectionItems(d, "Revisit Condition"))) {
    warn("missing-review-condition", "No explicit revisit condition.");
  }
  const expected = sectionItems(d, "Expected Outcome");
  if (expected.some((line) => /\u2192|->|%|increase|drop|fall|rise/i.test(line))) {
    let metricsLower = "";
    try {
      const metricsFile = path.join(findProductRoot(process.cwd()), ".product", "METRICS.md");
      metricsLower = readFileSync(metricsFile, "utf8").toLowerCase();
    } catch {
      metricsLower = "";
    }
    if (!/baseline:\s*(?!unknown\b)[^\n]*\S/.test(metricsLower)) {
      warn("metric-without-baseline", "Prediction uses a relative change but no baseline is defined in METRICS.md.");
    }
  }
  for (const item of sectionItems(d, "Evidence")) {
    const m = item.match(/Date:\s*(\d{4})-(\d{2})(?:-(\d{2}))?/);
    if (!m) continue;
    const date = `${m[1]}-${m[2]}-${m[3] ?? "15"}`;
    const age = Math.round((Date.parse(now) - Date.parse(date)) / 86400000);
    if (age > 365) {
      warn("stale-evidence", `Evidence dated ${date} is potentially stale (>365 days old): "${item.slice(0, 100)}".`);
    } else if (age > 90) {
      warn("stale-evidence", `Evidence dated ${date} is potentially stale (90\u2013365 days old): "${item.slice(0, 100)}".`);
    }
  }
  const facts = new Set(sectionItems(d, "Facts").map((s) => s.trim()));
  for (const a of sectionItems(d, "Assumptions")) {
    if (facts.has(a.trim())) err("assumption-as-fact", `Duplicate statement in Facts and Assumptions: "${a.trim().slice(0, 80)}"`);
  }
  if (!hasContent(sectionItems(d, "Strongest Argument Against"))) {
    warn("no-dissent", "No strongest argument against recorded.");
  }
  if ((d.status === "validating" || d.status === "ready") && !hasContent(sectionItems(d, "SVT"))) {
    warn("missing-svt", "Validating/ready bet without a Smallest Valuable Test (SVT).");
  }
  if (["building", "measuring"].includes(d.status) && !hasContent(sectionItems(d, "Scope"))) {
    warn("missing-scope", "Building/measuring bet without a defined scope.");
  }
  if ((d.confidence === "low" || d.confidence === "medium") &&
      !hasContent(sectionItems(d, "What Would Change Our Mind"))) {
    warn("missing-wwcm", "Low/medium-confidence decision without what-would-change-our-mind.");
  }
  if (ACCEPTED_PLUS.includes(d.status) && !hasContent(sectionItems(d, "Final Human Decision"))) {
    err("no-human-decision", "Accepted decision without explicit human decision.");
  }
  if (ACCEPTED_PLUS.includes(d.status) && !d.goal) {
    err("orphan-decision", "Accepted decision not linked to a goal or strategy.");
  }
  if (d.reviewDate && d.reviewDate < now && ACCEPTED_PLUS.includes(d.status) && d.status !== "reviewed") {
    warn("stale-review", `Review date ${d.reviewDate} passed; decision not reviewed.`);
  }
  if (sectionItems(d, "Primary Metric").length > 0) {
    const expected = sectionItems(d, "Expected Outcome").join(" ").toLowerCase();
    if (!/guardrail/.test(expected) && !hasContent(sectionItems(d, "Guardrails"))) {
      warn("missing-guardrail", "Primary metric without guardrail.");
    }
    const guardrails = [
      ...sectionItems(d, "Guardrails").filter((l) => !/^unknown\.?$/i.test(l)),
      ...sectionItems(d, "Expected Outcome")
        .filter((l) => /guardrail/i.test(l))
        .map((l) => l.replace(/^guardrail:\s*/i, "")),
    ];
    for (const line of guardrails) {
      if (!/\d/.test(line)) {
        warn("guardrail-without-baseline", `Guardrail has no quantified threshold: "${line.slice(0, 80)}".`);
      }
    }
  }
  for (const item of sectionItems(d, "Evidence")) {
    const access = (item.match(/Access:\s*(\w+)/i) ?? [])[1]?.toLowerCase();
    if (access === "gated") {
      warn("gated-evidence", "Evidence cites gated content (not publicly verifiable).");
    }
  }
  if (d.status === "reviewed" && !hasContent(sectionItems(d, "Observed Result"))) {
    err("conflicting-status", "Status 'reviewed' without observed result.");
  }
  if (d.status === "superseded" && !d.supersededBy) {
    err("conflicting-status", "Status 'superseded' without superseded_by.");
  }
  return out;
}

function main() {
  const root = findProductRoot(process.cwd());
  if (!root) {
    console.error("error: no .product/ found in this directory tree");
    process.exit(1);
  }
  const { decisions, errors } = loadAll(root);
  let failed = errors.length > 0;
  for (const e of errors) console.error(e);

  const seenIds = new Set();
  for (const d of decisions) {
    if (seenIds.has(d.id)) {
      failed = true;
      console.error(`${d.id}  ERROR  duplicate: more than one decision file uses id ${d.id}`);
      continue;
    }
    seenIds.add(d.id);
  }

  for (const d of decisions) {
    for (const [severity, rule, msg] of lint(d)) {
      if (severity === "ERROR") failed = true;
      console.log(`${d.id}  ${severity}  ${rule}: ${msg}`);
    }
  }
  console.log(failed ? `validate: ${decisions.length} decision(s) checked, errors found` : `validate: ${decisions.length} decision(s) OK`);
  process.exit(failed ? 1 : 0);
}

main();

import { lintAll } from "./linters.js";
import type { AuditSummary, Decision, LintFinding } from "./types.js";

/**
 * Decision Health audit (PRD §53). Deterministic: same inputs always
 * produce the same counts and findings.
 */
export function auditDecisions(
  decisions: Decision[],
  opts: { now: string; metrics: string },
): AuditSummary {
  const byStatus: AuditSummary["byStatus"] = {
    draft: 0,
    shaping: 0,
    validating: 0,
    ready: 0,
    proposed: 0,
    accepted: 0,
    building: 0,
    shipped: 0,
    measuring: 0,
    reviewed: 0,
    rejected: 0,
    cancelled: 0,
    paused: 0,
    failed: 0,
    superseded: 0,
  };
  for (const d of decisions) {
    byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
  }

  const accepted = decisions.filter((d) =>
    ["accepted", "building", "shipped", "measuring", "reviewed", "superseded"].includes(d.status),
  );
  const waitingForReview = decisions.filter(
    (d) =>
      ["accepted", "building", "shipped", "measuring"].includes(d.status) &&
      d.reviewDate !== undefined &&
      d.reviewDate !== null &&
      d.reviewDate < opts.now,
  ).length;

  const findings = lintAll({ allDecisions: decisions, now: opts.now, metrics: opts.metrics });

  const all: LintFinding[] = [];
  for (const [id, list] of findings) {
    for (const f of list) all.push({ ...f, decisionId: id });
  }

  return {
    total: decisions.length,
    byStatus,
    accepted: accepted.length,
    reviewed: byStatus.reviewed,
    waitingForReview,
    missingSuccessMetrics: all.filter(
      (f) => f.rule === "missing-success-metric" && f.severity === "ERROR",
    ).length,
    missingAlternatives: all.filter((f) => f.rule === "missing-alternative").length,
    lowConfidence: decisions.filter((d) => d.confidence === "low").length,
    findings: all,
  };
}

const STATUS_LABEL: Record<string, string> = {
  draft: "draft",
  shaping: "shaping",
  validating: "validating",
  ready: "ready",
  proposed: "proposed",
  accepted: "accepted",
  building: "building",
  shipped: "shipped",
  measuring: "measuring",
  reviewed: "reviewed",
  rejected: "rejected",
  cancelled: "cancelled",
  paused: "paused",
  failed: "failed",
  superseded: "superseded",
};

/** Formats the audit as the PRD §53 Decision Health report. */
export function formatAudit(summary: AuditSummary): string {
  const lines: string[] = [];
  lines.push("Decision Health");
  lines.push("");
  lines.push(`${summary.total} total decisions`);
  for (const [status, count] of Object.entries(summary.byStatus)) {
    if (count === 0) continue;
    lines.push(`${count} ${STATUS_LABEL[status] ?? status}`);
  }
  lines.push(`${summary.reviewed} reviewed`);
  lines.push(`${summary.waitingForReview} waiting for review`);
  lines.push(`${summary.missingSuccessMetrics} missing success metrics`);
  lines.push(`${summary.missingAlternatives} missing alternatives`);
  lines.push(`${summary.lowConfidence} low-confidence decisions`);
  lines.push("");

  const errors = summary.findings.filter((f) => f.severity === "ERROR");
  const warnings = summary.findings.filter((f) => f.severity === "WARNING");
  const infos = summary.findings.filter((f) => f.severity === "INFO");

  if (errors.length > 0) {
    lines.push("CRITICAL");
    lines.push("");
    for (const f of errors) lines.push(`${f.decisionId}`, formatFinding(f));
    lines.push("");
  }
  if (warnings.length > 0) {
    lines.push("WARNING");
    lines.push("");
    for (const f of warnings) lines.push(`${f.decisionId}`, formatFinding(f));
    lines.push("");
  }
  if (infos.length > 0) {
    lines.push("INFO");
    lines.push("");
    for (const f of infos) lines.push(`${f.decisionId}`, formatFinding(f));
    lines.push("");
  }

  return lines.join("\n").replace(/\n+$/, "") + "\n";
}

function formatFinding(f: LintFinding): string {
  return `  ${f.rule}: ${f.message}`;
}

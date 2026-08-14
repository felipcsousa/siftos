import type { Decision } from "./types.js";

/**
 * Ship Gate (PRD V2 §74–§76, §94): deterministic readiness check before a
 * bet ships. Controls the ProductOS Bet lifecycle, never production
 * deployment authorization.
 *
 * Automatic (Turn Stop hook) and manual (`siftos ship <id>`) paths share
 * this exact logic (PRD FR-SHIP-004).
 */

export type ShipGateResult = "PASS" | "PASS_WITH_WARNINGS" | "FAIL" | "NOT_REQUIRED";

export interface ShipGateFinding {
  rule: string;
  severity: "ERROR" | "WARNING";
  message: string;
}

const ACCEPTED_PLUS = ["accepted", "building", "shipped", "measuring", "reviewed", "superseded"];

function hasContent(items: string[] | undefined): boolean {
  return (items ?? []).length > 0;
}

function section(d: Decision, name: string): string[] {
  return d.body[name] ?? [];
}

function bodyText(d: Decision): string {
  return Object.values(d.body)
    .flat()
    .join("\n")
    .toLowerCase();
}

export function shipGate(
  decision: Decision,
  ctx: { metrics: string },
): { result: ShipGateResult; findings: ShipGateFinding[] } {
  if (!ACCEPTED_PLUS.includes(decision.status)) {
    return { result: "NOT_REQUIRED", findings: [] };
  }

  const findings: ShipGateFinding[] = [];
  const err = (rule: string, message: string) =>
    findings.push({ rule, severity: "ERROR", message });
  const warn = (rule: string, message: string) =>
    findings.push({ rule, severity: "WARNING", message });

  // PRD §74: target user, problem, expected outcome, metric, baseline,
  // success threshold, instrumentation, guardrails, review condition, scope.
  if (!hasContent(section(decision, "Target User"))) {
    warn("missing-target-user", "No target user defined.");
  }
  const hasGoalField = Boolean(decision.goal?.trim());
  if (!hasContent(section(decision, "Goal")) && !hasContent(section(decision, "Context")) && !hasGoalField) {
    err("missing-problem", "No problem/goal defined — a bet ships against a problem.");
  }
  const hasMetric =
    hasContent(section(decision, "Primary Metric")) ||
    hasContent(section(decision, "Expected Outcome"));
  if (!hasContent(section(decision, "Expected Outcome"))) {
    // v0.2 records may express the outcome only via Primary Metric;
    // absent both, this is a hard failure (missing-metric covers it).
    if (!hasMetric) {
      err("missing-expected-outcome", "No expected outcome or primary metric recorded.");
    } else {
      warn("missing-expected-outcome", "No quantified expected outcome — only a primary metric.");
    }
  }
  if (!hasMetric) {
    err("missing-metric", "No primary metric or expected outcome to measure.");
  }
  const expectedText = section(decision, "Expected Outcome").join(" ");
  if (!/\d/.test(expectedText)) {
    warn("missing-success-threshold", "Success threshold is not quantified.");
  }
  const baselineLower = ctx.metrics.toLowerCase();
  const hasBaseline = /baseline:\s*(?!unknown\b)[^\n]*\S/.test(baselineLower);
  if (!hasBaseline && !/\d/.test(expectedText)) {
    warn("missing-baseline", "No baseline — relative success cannot be evaluated.");
  }
  const allText = bodyText(decision);
  if (!/\b(instrument|analytics|event|track)\b/i.test(allText)) {
    warn("missing-instrumentation", "No instrumentation/measurement plan detected.");
  }
  if (!hasContent(section(decision, "Guardrails"))) {
    warn("missing-guardrail", "No guardrails defined.");
  }
  if (!hasContent(section(decision, "Revisit Condition"))) {
    warn("missing-review-condition", "No revisit condition defined.");
  }
  if (!hasContent(section(decision, "Scope"))) {
    warn("missing-scope", "No scope defined — scope drift cannot be checked.");
  }

  const hasErrors = findings.some((f) => f.severity === "ERROR");
  if (hasErrors) return { result: "FAIL", findings };
  return { result: findings.length > 0 ? "PASS_WITH_WARNINGS" : "PASS", findings };
}

export function formatShipGate(result: ShipGateResult, findings: ShipGateFinding[]): string {
  const lines: string[] = [];
  lines.push(`SHIP GATE: ${result}`);
  lines.push("");
  for (const f of findings) {
    lines.push(`${f.severity === "ERROR" ? "ERROR" : "WARNING"}  ${f.rule}: ${f.message}`);
  }
  return lines.join("\n") + "\n";
}

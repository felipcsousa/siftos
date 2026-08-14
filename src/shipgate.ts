import type { Decision } from "./types.js";
import { SHIP_GATE_STATUSES } from "./guard.js";

export type ShipGateResult = "PASS" | "PASS_WITH_WARNINGS" | "FAIL" | "NOT_REQUIRED";

export interface ShipGateFinding {
  rule: string;
  severity: "ERROR" | "WARNING";
  message: string;
}

function hasContent(items: string[] | undefined): boolean {
  return (items ?? []).length > 0;
}

function section(decision: Decision, name: string): string[] {
  return decision.body[name] ?? [];
}

function bodyText(decision: Decision): string {
  return Object.values(decision.body).flat().join("\n").toLowerCase();
}

/**
 * Canonical deterministic Ship Gate. `reviewed` and `superseded` are
 * terminal/history states, not build authorizations, so they are NOT_REQUIRED.
 */
export function shipGate(
  decision: Decision,
  ctx: { metrics: string },
): { result: ShipGateResult; findings: ShipGateFinding[] } {
  if (!SHIP_GATE_STATUSES.has(decision.status)) return { result: "NOT_REQUIRED", findings: [] };

  const findings: ShipGateFinding[] = [];
  const error = (rule: string, message: string) => findings.push({ rule, severity: "ERROR" as const, message });
  const warn = (rule: string, message: string) => findings.push({ rule, severity: "WARNING" as const, message });

  if (!hasContent(section(decision, "Target User"))) warn("missing-target-user", "No target user defined.");
  const hasGoal = Boolean(decision.goal?.trim()) || hasContent(section(decision, "Goal")) || hasContent(section(decision, "Context"));
  if (!hasGoal) error("missing-problem", "No problem/goal defined — a bet ships against a problem.");

  const hasExpected = hasContent(section(decision, "Expected Outcome"));
  const hasPrimaryMetric = hasContent(section(decision, "Primary Metric"));
  if (!hasExpected && !hasPrimaryMetric) {
    error("missing-expected-outcome", "No expected outcome or primary metric recorded.");
    error("missing-metric", "No primary metric or expected outcome to measure.");
  } else if (!hasExpected) {
    warn("missing-expected-outcome", "No quantified expected outcome — only a primary metric.");
  }

  const expectedText = section(decision, "Expected Outcome").join(" ");
  if (!/\d/.test(expectedText)) warn("missing-success-threshold", "Success threshold is not quantified.");

  const hasBaseline = /baseline:\s*(?!unknown\b)[^\n]*\S/i.test(ctx.metrics);
  if (!hasBaseline && !/\d/.test(expectedText)) warn("missing-baseline", "No baseline — relative success cannot be evaluated.");

  if (!/\b(instrument|analytics|event|track)\b/i.test(bodyText(decision))) {
    warn("missing-instrumentation", "No instrumentation/measurement plan detected.");
  }
  if (!hasContent(section(decision, "Guardrails"))) warn("missing-guardrail", "No guardrails defined.");
  if (!hasContent(section(decision, "Revisit Condition"))) warn("missing-review-condition", "No revisit condition defined.");
  if (!hasContent(section(decision, "Scope"))) warn("missing-scope", "No scope defined — scope drift cannot be checked.");

  if (findings.some((finding) => finding.severity === "ERROR")) return { result: "FAIL", findings };
  return { result: findings.length > 0 ? "PASS_WITH_WARNINGS" : "PASS", findings };
}

export function formatShipGate(result: ShipGateResult, findings: ShipGateFinding[]): string {
  const lines = [`SHIP GATE: ${result}`, ""];
  for (const finding of findings) {
    lines.push(`${finding.severity}  ${finding.rule}: ${finding.message}`);
  }
  return lines.join("\n") + "\n";
}

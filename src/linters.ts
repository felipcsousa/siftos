import type { Decision, LintContext, LintFinding, LintRule } from "./types.js";

const ACCEPTED_PLUS = ["accepted", "building", "shipped", "measuring", "reviewed", "superseded"];

function hasContent(items: string[] | undefined): boolean {
  return (items ?? []).length > 0;
}

function section(d: Decision, name: string): string[] {
  return d.body[name] ?? [];
}

function findEvidenceDate(item: string): string | null {
  const m = item.match(/Date:\s*(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return null;
  const day = m[3] ?? "15";
  return `${m[1]}-${m[2]}-${day}`;
}

/** PRD §45 linter rules. Each rule is deterministic given its inputs. */
export const LINTERS: LintRule[] = [
  function missingGoal(ctx) {
    const goal = ctx.decision.goal?.trim();
    if (!goal || goal === "" || /^unknown\.?$/i.test(goal)) {
      return [finding("missing-goal", "WARNING", "This decision has no goal associated.")];
    }
    return [];
  },

  function missingAlternative(ctx) {
    const options = section(ctx.decision, "Options Considered");
    if (options.length < 2) {
      return [
        finding(
          "missing-alternative",
          "WARNING",
          "Fewer than two options considered (include alternatives and 'do nothing' when relevant).",
        ),
      ];
    }
    return [];
  },

  function missingSuccessMetric(ctx) {
    const d = ctx.decision;
    const accepted = ACCEPTED_PLUS.includes(d.status);
    const hasMetric = hasContent(section(d, "Primary Metric")) || hasContent(section(d, "Expected Outcome"));
    if (!hasMetric) {
      return [
        finding(
          "missing-success-metric",
          accepted ? "ERROR" : "WARNING",
          accepted
            ? "An accepted decision must have a verifiable outcome (primary metric or expected outcome)."
            : "This decision has no verifiable success metric.",
        ),
      ];
    }
    return [];
  },

  function missingReviewCondition(ctx) {
    if (!hasContent(section(ctx.decision, "Revisit Condition"))) {
      return [
        finding(
          "missing-review-condition",
          "WARNING",
          "This decision has no explicit revisit condition.",
        ),
      ];
    }
    return [];
  },

  function metricWithoutBaseline(ctx) {
    const expected = section(ctx.decision, "Expected Outcome");
    const hasDelta = expected.some((line) => /→|->|%|increase|drop|fall|rise/i.test(line));
    if (!hasDelta) return [];
    const metricsLower = ctx.metrics.toLowerCase();
    // A real baseline is "baseline:" followed by something that is not
    // the "unknown" placeholder (Retention/Revenue sections default to it).
    const hasRealBaseline = /baseline:\s*(?!unknown\b)[^\n]*\S/.test(metricsLower);
    if (!hasRealBaseline) {
      return [
        finding(
          "metric-without-baseline",
          "WARNING",
          "Prediction uses a relative change but no baseline is defined in METRICS.md.",
        ),
      ];
    }
    return [];
  },

  function assumptionAsFact(ctx) {
    const facts = new Set(section(ctx.decision, "Facts").map((s) => s.trim()));
    const collisions = section(ctx.decision, "Assumptions")
      .map((s) => s.trim())
      .filter((s) => facts.has(s));
    return collisions.map((text) =>
      finding(
        "assumption-as-fact",
        "ERROR",
        `The same statement appears as both Fact and Assumption: "${truncate(text, 80)}".`,
      ),
    );
  },

  function noDissent(ctx) {
    if (!hasContent(section(ctx.decision, "Strongest Argument Against"))) {
      return [
        finding(
          "no-dissent",
          "WARNING",
          "No strongest argument against recorded (dissent is required).",
        ),
      ];
    }
    return [];
  },

  function missingSVT(ctx) {
    const d = ctx.decision;
    if ((d.status === "validating" || d.status === "ready") && !hasContent(section(d, "SVT"))) {
      return [
        finding(
          "missing-svt",
          "WARNING",
          "A validating/ready bet must define its Smallest Valuable Test (SVT).",
        ),
      ];
    }
    return [];
  },

  function missingScope(ctx) {
    const d = ctx.decision;
    // building|measuring only: v0.2-era `shipped` records have no Scope
    // section by definition, so gating shipped would change their lint
    // result. The Ship Gate still warns missing-scope for shipped.
    if (
      (d.status === "building" || d.status === "measuring") &&
      hasContent(section(d, "Scope")) === false
    ) {
      return [
        finding(
          "missing-scope",
          "WARNING",
          "A building/shipped/measuring bet must define its scope.",
        ),
      ];
    }
    return [];
  },

  function missingWWCM(ctx) {
    const d = ctx.decision;
    const needsFalsifiability = d.confidence === "low" || d.confidence === "medium";
    if (needsFalsifiability && !hasContent(section(d, "What Would Change Our Mind"))) {
      return [
        finding(
          "missing-wwcm",
          "WARNING",
          "A low/medium-confidence decision must record what would change our mind (falsifiability, PRD §38).",
        ),
      ];
    }
    return [];
  },

  function noHumanDecision(ctx) {
    const d = ctx.decision;
    if (
      ACCEPTED_PLUS.includes(d.status) &&
      !hasContent(section(d, "Final Human Decision"))
    ) {
      return [
        finding(
          "no-human-decision",
          "ERROR",
          "An AI recommendation cannot become an accepted Product Decision without an explicit human decision.",
        ),
      ];
    }
    return [];
  },

  function orphanDecision(ctx) {
    const d = ctx.decision;
    if (ACCEPTED_PLUS.includes(d.status) && !d.goal?.trim()) {
      return [
        finding(
          "orphan-decision",
          "ERROR",
          "Accepted decision is not linked to a goal or strategy.",
        ),
      ];
    }
    return [];
  },

  function staleReview(ctx) {
    const d = ctx.decision;
    if (!d.reviewDate) return [];
    if (!ACCEPTED_PLUS.includes(d.status)) return [];
    if (d.status === "reviewed") return [];
    if (d.reviewDate < ctx.now) {
      return [
        finding(
          "stale-review",
          "WARNING",
          `Review date ${d.reviewDate} has passed and the decision has not been reviewed.`,
        ),
      ];
    }
    return [];
  },

  function missingGuardrail(ctx) {
    const d = ctx.decision;
    const hasMetric = hasContent(section(d, "Primary Metric"));
    if (!hasMetric) return [];
    const guardrail = section(d, "Expected Outcome").some((line) =>
      /guardrail/i.test(line),
    );
    if (!guardrail && !hasContent(section(d, "Guardrails"))) {
      return [
        finding(
          "missing-guardrail",
          "WARNING",
          "Experiment has a primary metric but no guardrail.",
        ),
      ];
    }
    return [];
  },

  function staleEvidence(ctx) {
    const out: LintFinding[] = [];
    for (const item of section(ctx.decision, "Evidence")) {
      const date = findEvidenceDate(item);
      if (!date) continue;
      const ageDays = daysBetween(date, ctx.now);
      if (ageDays > 365) {
        out.push(
          finding(
            "stale-evidence",
            "WARNING",
            `Evidence dated ${date} is potentially stale (>365 days old): "${truncate(item, 100)}".`,
          ),
        );
      } else if (ageDays > 90) {
        out.push(
          finding(
            "stale-evidence",
            "INFO",
            `Evidence dated ${date} is potentially stale (90–365 days old): "${truncate(item, 100)}".`,
          ),
        );
      }
    }
    return out;
  },

  function conflictingStatus(ctx) {
    const d = ctx.decision;
    const out: LintFinding[] = [];
    if (d.status === "reviewed" && !hasContent(section(d, "Observed Result"))) {
      out.push(
        finding(
          "conflicting-status",
          "ERROR",
          "Status is 'reviewed' but no observed result is recorded.",
        ),
      );
    }
    if (d.status === "superseded" && !d.supersededBy) {
      out.push(
        finding(
          "conflicting-status",
          "ERROR",
          "Status is 'superseded' but superseded_by is not set.",
        ),
      );
    }
    if (d.status === "proposed" && hasContent(section(d, "Final Human Decision"))) {
      out.push(
        finding(
          "conflicting-status",
          "WARNING",
          "Status is 'proposed' but a final human decision is already recorded.",
        ),
      );
    }
    return out;
  },

  function guardrailWithoutBaseline(ctx) {
    const out: LintFinding[] = [];
    const guardrails = section(ctx.decision, "Guardrails").filter(
      (line) => !/^unknown\.?$/i.test(line),
    );
    const expected = section(ctx.decision, "Expected Outcome")
      .filter((line) => /guardrail/i.test(line))
      .map((line) => line.replace(/^guardrail:\s*/i, ""));
    for (const line of [...guardrails, ...expected]) {
      if (!/\d/.test(line)) {
        out.push(
          finding(
            "guardrail-without-baseline",
            "WARNING",
            `Guardrail has no quantified threshold: "${truncate(line, 80)}".`,
          ),
        );
      }
    }
    return out;
  },

  function gatedEvidence(ctx) {
    const out: LintFinding[] = [];
    for (const item of section(ctx.decision, "Evidence")) {
      const access = item.match(/Access:\s*(\w+)/i)?.[1]?.toLowerCase();
      if (access === "gated") {
        out.push(
          finding(
            "gated-evidence",
            "WARNING",
            `Evidence cites gated content (not publicly verifiable): "${truncate(item, 100)}".`,
          ),
        );
      }
    }
    return out;
  },
];

export const LINT_RULES = new Map(LINTERS.map((rule) => [rule.name, rule]));

function finding(
  rule: string,
  severity: LintFinding["severity"],
  message: string,
): LintFinding {
  return { rule, severity, message };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

/** Days between two YYYY-MM-DD dates (b - a). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** Runs every rule for one decision. */
export function lintDecision(ctx: LintContext): LintFinding[] {
  return LINTERS.flatMap((rule) => rule(ctx));
}

/** Runs every rule over all decisions. */
export function lintAll(ctx: Omit<LintContext, "decision">): Map<string, LintFinding[]> {
  const out = new Map<string, LintFinding[]>();
  for (const decision of ctx.allDecisions) {
    out.set(decision.id, lintDecision({ ...ctx, decision }));
  }
  return out;
}

import type { Decision } from "../src/types.js";

export const NOW = "2026-08-13";

export function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "DEC-0001",
    title: "Test decision",
    status: "accepted",
    createdAt: "2026-08-01",
    updatedAt: "2026-08-01",
    tags: [],
    body: {},
    ...overrides,
  };
}

export function withSections(
  d: Decision,
  sections: Record<string, string[]>,
): Decision {
  return { ...d, body: { ...d.body, ...sections } };
}

/** A fully compliant accepted decision (baseline for linter tests). */
export function cleanDecision(): Decision {
  return withSections(
    makeDecision({
      goal: "improve-activation",
      confidence: "medium",
      reversibility: "high",
      costOfDelay: "medium",
      reviewDate: "2026-09-13",
      tags: ["onboarding"],
    }),
    {
      "Options Considered": [
        "A. Keep mandatory card.",
        "B. Make card optional.",
        "C. Controlled experiment.",
      ],
      "Facts": ["38% of users abandon at the payment step."],
      "Evidence": [
        "Claim: 38% abandonment on payment step | Source: Amplitude dashboard | Date: 2026-08-10",
      ],
      "Assumptions": ["Abuse will remain manageable."],
      "Primary Metric": ["Activation rate."],
      "Expected Outcome": [
        "Activation: 24% → 30–34%.",
        "Guardrail: trial-to-paid decline < 3pp.",
      ],
      "Strongest Argument Against": [
        "Improved activation could be offset by lower trial quality.",
      ],
      "Final Human Decision": ["Run a 50/50 experiment for new self-service accounts."],
      "Revisit Condition": ["After 500 trials or 30 days."],
    },
  );
}

/** METRICS.md content with a real activation baseline. */
export const METRICS_WITH_BASELINE = `# Metrics

## Activation

Metric:
Activation rate.

Definition:
Share reaching first value within 7 days.

Baseline:
24%

Target:
30%
`;

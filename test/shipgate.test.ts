import { describe, expect, it } from "vitest";
import { formatShipGate, shipGate } from "../src/shipgate.js";
import { cleanDecision, makeDecision, withSections, METRICS_WITH_BASELINE } from "./helpers.js";

describe("shipGate (PRD V2 §74–§76)", () => {
  it("NOT_REQUIRED before the accepted+ lifecycle", () => {
    expect(shipGate(makeDecision({ status: "draft" }), { metrics: "" }).result).toBe(
      "NOT_REQUIRED",
    );
    expect(shipGate(makeDecision({ status: "ready" }), { metrics: "" }).result).toBe(
      "NOT_REQUIRED",
    );
  });

  it("PASS for a fully measured bet", () => {
    const d = withSections(cleanDecision(), {
      Goal: ["Increase activation without reducing trial quality."],
      "Target User": ["Self-service SMB founders."],
      Scope: ["Remove phone.", "Remove company size."],
      "Non-Goals": ["Redesign onboarding."],
      "Expected Outcome": [
        "Activation: 24% → 30–34%.",
        "Guardrail: trial-to-paid decline < 3pp.",
        "Instrument: activation event + trial-to-paid funnel.",
      ],
      Guardrails: ["Trial-to-paid decline < 3pp."],
    });
    expect(shipGate(d, { metrics: METRICS_WITH_BASELINE }).result).toBe("PASS");
  });

  it("FAIL on missing problem or metric (ERROR-level)", () => {
    const bare = makeDecision({ status: "building" });
    const { result, findings } = shipGate(bare, { metrics: "" });
    expect(result).toBe("FAIL");
    expect(findings.some((f) => f.rule === "missing-problem")).toBe(true);
    expect(findings.some((f) => f.rule === "missing-metric")).toBe(true);
  });

  it("legacy v0.2 shape (frontmatter goal, primary metric only) never FAILs", () => {
    // A v0.2-era accepted decision: goal lives in frontmatter, outcome is
    // expressed via Primary Metric, no V2 sections at all.
    const legacy = makeDecision({
      status: "accepted",
      goal: "improve-activation",
      confidence: "medium",
    });
    const { result, findings } = shipGate(
      withSections(legacy, {
        "Primary Metric": ["Activation rate: 24% → 30-34%."],
        "Revisit Condition": ["After 500 trials or 30 days."],
      }),
      { metrics: "" },
    );
    expect(result).not.toBe("FAIL");
    expect(findings.some((f) => f.severity === "ERROR")).toBe(false);
  });

  it("PASS_WITH_WARNINGS when only WARNING-level gaps remain", () => {
    const d = withSections(cleanDecision(), { Goal: ["Increase activation."] });
    const { result, findings } = shipGate(d, { metrics: "" });
    expect(result).toBe("PASS_WITH_WARNINGS");
    expect(findings.every((f) => f.severity === "WARNING")).toBe(true);
  });

  it("formatShipGate renders the result and findings", () => {
    const { result, findings } = shipGate(makeDecision({ status: "building" }), { metrics: "" });
    const out = formatShipGate(result, findings);
    expect(out).toContain("SHIP GATE: FAIL");
    expect(out).toContain("ERROR  missing-problem");
  });
});

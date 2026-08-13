import { describe, expect, it } from "vitest";
import { auditDecisions, formatAudit } from "../src/audit.js";
import { cleanDecision, makeDecision, withSections, METRICS_WITH_BASELINE, NOW } from "./helpers.js";

describe("auditDecisions", () => {
  it("counts totals, statuses and health signals", () => {
    const decisions = [
      cleanDecision(),
      makeDecision({ id: "DEC-0002", status: "proposed" }),
      makeDecision({ id: "DEC-0003", status: "accepted", reviewDate: "2026-07-01" }), // stale + no metric
      makeDecision({ id: "DEC-0004", status: "reviewed", confidence: "low" }),
    ];
    const summary = auditDecisions(decisions, { now: NOW, metrics: METRICS_WITH_BASELINE });
    expect(summary.total).toBe(4);
    expect(summary.byStatus.accepted).toBe(2); // DEC-0001 + DEC-0003
    expect(summary.reviewed).toBe(1);
    expect(summary.waitingForReview).toBe(1); // DEC-0003
    expect(summary.lowConfidence).toBe(1);
    expect(summary.findings.some((f) => f.rule === "stale-review")).toBe(true);
  });

  it("computes missingSuccessMetrics from ERROR findings", () => {
    const decisions = [
      makeDecision({ id: "DEC-0001", status: "accepted" }),
      withSections(makeDecision({ id: "DEC-0002", status: "accepted", goal: "g" }), {
        "Primary Metric": ["Activation rate."],
      }),
    ];
    const summary = auditDecisions(decisions, { now: NOW, metrics: "" });
    // DEC-0001: missing-success-metric ERROR + orphan ERROR; DEC-0002: metric present.
    expect(summary.missingSuccessMetrics).toBe(1);
    expect(summary.missingAlternatives).toBe(2);
  });
  it("is deterministic for the same inputs", () => {
    const decisions = [cleanDecision(), makeDecision({ id: "DEC-0009", status: "draft" })];
    const a = auditDecisions(decisions, { now: NOW, metrics: METRICS_WITH_BASELINE });
    const b = auditDecisions(decisions, { now: NOW, metrics: METRICS_WITH_BASELINE });
    expect(a).toEqual(b);
  });
});

describe("formatAudit", () => {
  it("renders the PRD §53 report shape", () => {
    const summary = auditDecisions([makeDecision({ status: "accepted" })], {
      now: NOW,
      metrics: "",
    });
    const text = formatAudit(summary);
    expect(text).toContain("Decision Health");
    expect(text).toContain("1 total decisions");
    expect(text).toContain("1 accepted");
    expect(text).toContain("CRITICAL");
    expect(text).toContain("no-human-decision");
  });

  it("flags nothing on a clean set", () => {
    const text = formatAudit(auditDecisions([cleanDecision()], { now: NOW, metrics: METRICS_WITH_BASELINE }));
    expect(text).not.toContain("CRITICAL");
    expect(text).not.toContain("WARNING");
  });
});

describe("reviewed decisions with learnings", () => {
  it("accepts a completed review cycle without findings", () => {
    const reviewed = withSections(
      makeDecision({
        id: "DEC-0031",
        status: "reviewed",
        goal: "g",
        reviewDate: "2026-07-01",
        confidence: "medium",
      }),
      {
        "Final Human Decision": ["Invest in the app."],
        "Primary Metric": ["Weekly engagement."],
        "Expected Outcome": ["Weekly engagement +10%."],
        "Observed Result": ["Weekly engagement rose 11%."],
        "Revisit Condition": ["After 6 months."],
        "Strongest Argument Against": ["Cost may exceed gains."],
        "Options Considered": ["A. App.", "B. Mobile web.", "C. Do nothing."],
      },
    );
    const summary = auditDecisions([reviewed], { now: NOW, metrics: METRICS_WITH_BASELINE });
    const errorFindings = summary.findings.filter((f) => f.severity === "ERROR");
    expect(errorFindings).toEqual([]);
  });
});

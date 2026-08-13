import { describe, expect, it } from "vitest";
import { lintDecision, lintAll, LINTERS } from "../src/linters.js";
import type { Decision, LintContext } from "../src/types.js";
import {
  cleanDecision,
  makeDecision,
  withSections,
  METRICS_WITH_BASELINE,
  NOW,
} from "./helpers.js";

function ctx(d: Decision, metrics = METRICS_WITH_BASELINE): LintContext {
  return { decision: d, allDecisions: [d], now: NOW, metrics };
}

function rules(d: Decision): string[] {
  return lintDecision(ctx(d)).map((f) => f.rule);
}

function has(d: Decision, rule: string, severity?: string): boolean {
  return lintDecision(ctx(d)).some(
    (f) => f.rule === rule && (severity === undefined || f.severity === severity),
  );
}

describe("linters: baseline behavior", () => {
  it("clean decision produces no findings", () => {
    expect(lintDecision(ctx(cleanDecision()))).toEqual([]);
  });

  it("registers all 15 rules", () => {
    expect(LINTERS).toHaveLength(15);
  });
});

describe("missing-goal", () => {
  it("fires without goal", () => {
    expect(has(makeDecision(), "missing-goal")).toBe(true);
  });
  it("silent with goal", () => {
    expect(has(makeDecision({ goal: "x" }), "missing-goal")).toBe(false);
  });
});

describe("missing-alternative", () => {
  it("fires with fewer than two options", () => {
    const d = withSections(makeDecision(), { "Options Considered": ["A. Only option."] });
    expect(has(d, "missing-alternative")).toBe(true);
  });
  it("silent with two or more options", () => {
    const d = withSections(makeDecision(), {
      "Options Considered": ["A. One.", "B. Two.", "C. Do nothing."],
    });
    expect(has(d, "missing-alternative")).toBe(false);
  });
});

describe("missing-success-metric", () => {
  it("is WARNING pre-acceptance, ERROR accepted+", () => {
    expect(has(makeDecision({ status: "draft" }), "missing-success-metric", "WARNING")).toBe(true);
    expect(has(makeDecision({ status: "accepted" }), "missing-success-metric", "ERROR")).toBe(true);
  });
  it("silent with a primary metric", () => {
    const d = withSections(makeDecision(), { "Primary Metric": ["Activation rate."] });
    expect(has(d, "missing-success-metric")).toBe(false);
  });
});

describe("missing-review-condition", () => {
  it("fires without revisit condition", () => {
    expect(has(makeDecision(), "missing-review-condition")).toBe(true);
  });
  it("silent with one", () => {
    const d = withSections(makeDecision(), { "Revisit Condition": ["After 30 days."] });
    expect(has(d, "missing-review-condition")).toBe(false);
  });
});

describe("metric-without-baseline", () => {
  it("fires on relative prediction without baseline", () => {
    const d = withSections(makeDecision(), {
      "Expected Outcome": ["Activation: 24% → 30–34%."],
    });
    const findings = lintDecision({ decision: d, allDecisions: [d], now: NOW, metrics: "" });
    expect(findings.some((f) => f.rule === "metric-without-baseline")).toBe(true);
  });
  it("silent when METRICS.md has a real baseline", () => {
    const d = withSections(makeDecision(), {
      "Expected Outcome": ["Activation: 24% → 30–34%."],
    });
    expect(has(d, "metric-without-baseline")).toBe(false); // METRICS_WITH_BASELINE provided
  });
  it("silent without a relative prediction", () => {
    const d = withSections(makeDecision(), { "Expected Outcome": ["Ship by Q3."] });
    expect(has(d, "metric-without-baseline")).toBe(false);
  });
});

describe("assumption-as-fact", () => {
  it("fires when a statement appears in Facts and Assumptions", () => {
    const d = withSections(makeDecision(), {
      Facts: ["Users want this feature."],
      Assumptions: ["Users want this feature."],
    });
    const findings = lintDecision(ctx(d)).filter((f) => f.rule === "assumption-as-fact");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("ERROR");
  });
  it("silent with disjoint statements", () => {
    const d = withSections(makeDecision(), {
      Facts: ["Users want this feature."],
      Assumptions: ["Engineering cost stays under two weeks."],
    });
    expect(has(d, "assumption-as-fact")).toBe(false);
  });
});

describe("no-dissent", () => {
  it("fires without strongest argument against", () => {
    expect(has(makeDecision(), "no-dissent")).toBe(true);
  });
});

describe("no-human-decision", () => {
  it("fires ERROR on accepted+ without human decision", () => {
    expect(has(makeDecision({ status: "accepted" }), "no-human-decision", "ERROR")).toBe(true);
    expect(has(makeDecision({ status: "shipped" }), "no-human-decision", "ERROR")).toBe(true);
  });
  it("silent pre-acceptance", () => {
    expect(has(makeDecision({ status: "proposed" }), "no-human-decision")).toBe(false);
  });
  it("silent with a human decision", () => {
    const d = withSections(makeDecision(), { "Final Human Decision": ["Ship it."] });
    expect(has(d, "no-human-decision")).toBe(false);
  });
});

describe("orphan-decision", () => {
  it("fires ERROR on accepted+ without goal", () => {
    expect(has(makeDecision({ status: "accepted" }), "orphan-decision", "ERROR")).toBe(true);
  });
  it("silent with goal", () => {
    expect(has(makeDecision({ goal: "g" }), "orphan-decision")).toBe(false);
  });
});

describe("stale-review", () => {
  it("fires when review_date passed and status open", () => {
    const d = makeDecision({ reviewDate: "2026-07-01" });
    expect(has(d, "stale-review")).toBe(true);
  });
  it("silent for future review dates", () => {
    const d = makeDecision({ reviewDate: "2026-09-01" });
    expect(has(d, "stale-review")).toBe(false);
  });
  it("silent once reviewed", () => {
    const d = makeDecision({ status: "reviewed", reviewDate: "2026-07-01" });
    expect(has(d, "stale-review")).toBe(false);
  });
});

describe("missing-guardrail", () => {
  it("fires with metric but no guardrail", () => {
    const d = withSections(makeDecision(), { "Primary Metric": ["Activation rate."] });
    expect(has(d, "missing-guardrail")).toBe(true);
  });
  it("silent when expected outcome carries a guardrail", () => {
    const d = withSections(makeDecision(), {
      "Primary Metric": ["Activation rate."],
      "Expected Outcome": ["Guardrail: trial-to-paid decline < 3pp."],
    });
    expect(has(d, "missing-guardrail")).toBe(false);
  });
});

describe("guardrail-without-baseline", () => {
  it("fires on unquantified guardrails", () => {
    const d = withSections(makeDecision(), {
      "Primary Metric": ["Activation rate."],
      "Expected Outcome": ["Guardrail: activation quality unchanged."],
    });
    expect(has(d, "guardrail-without-baseline")).toBe(true);
  });
  it("fires on unquantified Guardrails section items", () => {
    const d = withSections(makeDecision(), {
      "Primary Metric": ["Activation rate."],
      Guardrails: ["Quality stays acceptable."],
    });
    expect(has(d, "guardrail-without-baseline")).toBe(true);
  });
  it("silent on quantified guardrails", () => {
    const d = withSections(makeDecision(), {
      "Primary Metric": ["Activation rate."],
      "Expected Outcome": ["Guardrail: trial-to-paid decline < 3pp."],
    });
    expect(has(d, "guardrail-without-baseline")).toBe(false);
  });
  it("silent without guardrails", () => {
    expect(has(makeDecision(), "guardrail-without-baseline")).toBe(false);
  });
});

describe("gated-evidence", () => {
  it("fires on evidence marked Access: gated", () => {
    const d = withSections(makeDecision(), {
      Evidence: ["Claim: x | Source: Reforge course | Source URL: https://reforge.com/courses | Access: gated"],
    });
    const findings = lintDecision(ctx(d)).filter((f) => f.rule === "gated-evidence");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("WARNING");
  });
  it("silent on public or unmarked evidence", () => {
    const d = withSections(makeDecision(), {
      Evidence: [
        "Claim: x | Source: Reforge blog | Source URL: https://www.reforge.com/blog/x | Access: public",
        "Claim: y | Source: unspecified",
      ],
    });
    expect(has(d, "gated-evidence")).toBe(false);
  });
});

describe("stale-evidence", () => {
  it("flags evidence older than 365 days as WARNING", () => {
    const d = withSections(makeDecision(), {
      Evidence: ["Claim: old | Source: x | Date: 2024-01-10"],
    });
    const findings = lintDecision(ctx(d)).filter((f) => f.rule === "stale-evidence");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("WARNING");
  });
  it("flags evidence 90–365 days old as INFO", () => {
    const d = withSections(makeDecision(), {
      Evidence: ["Claim: mid | Source: x | Date: 2026-03-01"],
    });
    const findings = lintDecision(ctx(d)).filter((f) => f.rule === "stale-evidence");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("INFO");
  });
  it("silent for recent evidence and undated claims", () => {
    const d = withSections(makeDecision(), {
      Evidence: [
        "Claim: fresh | Source: x | Date: 2026-08-01",
        "Claim: no date | Source: unspecified",
      ],
    });
    expect(has(d, "stale-evidence")).toBe(false);
  });
});

describe("conflicting-status", () => {
  it("fires on reviewed without observed result", () => {
    const d = makeDecision({ status: "reviewed" });
    expect(has(d, "conflicting-status", "ERROR")).toBe(true);
  });
  it("fires on superseded without superseded_by", () => {
    const d = makeDecision({ status: "superseded" });
    expect(has(d, "conflicting-status", "ERROR")).toBe(true);
  });
  it("silent on valid combinations", () => {
    const d = withSections(
      makeDecision({
        status: "reviewed",
        reviewDate: "2026-07-01",
        supersedes: "DEC-0000",
      }),
      { "Observed Result": ["Activation +13.2%."] },
    );
    expect(has(d, "conflicting-status")).toBe(false);
  });
});

describe("lintAll", () => {
  it("maps findings per decision id", () => {
    const d1 = makeDecision({ id: "DEC-0001" });
    const d2 = { ...cleanDecision(), id: "DEC-0002" };
    const out = lintAll({
      allDecisions: [d1, d2],
      now: NOW,
      metrics: METRICS_WITH_BASELINE,
    });
    expect(out.has("DEC-0001")).toBe(true);
    expect(out.get("DEC-0002") ?? []).toEqual([]);
  });
});

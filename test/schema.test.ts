import { describe, expect, it } from "vitest";
import { decisionSchema, validateWithRepair } from "../src/schema.js";
import { validateDecision } from "../src/validator.js";
import { makeDecision } from "./helpers.js";

describe("decisionSchema", () => {
  it("accepts a valid decision", () => {
    const r = decisionSchema.safeParse(makeDecision());
    expect(r.success).toBe(true);
  });

  it("rejects invalid ids, statuses and dates", () => {
    expect(decisionSchema.safeParse(makeDecision({ id: "DEC-1" })).success).toBe(false);
    expect(decisionSchema.safeParse(makeDecision({ id: "DEC-0001x" })).success).toBe(false);
    expect(
      decisionSchema.safeParse(makeDecision({ status: "approved" as never })).success,
    ).toBe(false);
    expect(
      decisionSchema.safeParse(makeDecision({ createdAt: "2026/08/13" })).success,
    ).toBe(false);
    expect(
      decisionSchema.safeParse(makeDecision({ reviewDate: "not-a-date" })).success,
    ).toBe(false);
    expect(
      decisionSchema.safeParse(makeDecision({ betClass: "sideways" as never })).success,
    ).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    expect(decisionSchema.safeParse({ ...makeDecision(), evil: true }).success).toBe(false);
  });
});

describe("validateDecision (PRD §68 repair protocol)", () => {
  it("passes valid input unrepaired", () => {
    const r = validateDecision(makeDecision());
    expect(r.valid).toBe(true);
    expect(r.repaired).toBe(false);
  });

  it("repairs enum casing once", () => {
    const raw = {
      ...makeDecision(),
      status: "Accepted",
      confidence: "MEDIUM",
      bet_class: "Offense",
    };
    const r = validateWithRepair(raw);
    expect("decision" in r).toBe(true);
    if ("decision" in r) {
      expect(r.decision.status).toBe("accepted");
      expect(r.decision.confidence).toBe("medium");
      expect(r.decision.betClass).toBe("offense");
    }
  });

  it("repairs tags arriving as a string", () => {
    const r = validateWithRepair({ ...makeDecision(), tags: "onboarding,activation" });
    expect("decision" in r).toBe(true);
    if ("decision" in r) {
      expect(r.decision.tags).toEqual(["onboarding", "activation"]);
    }
  });

  it("fails explicitly on unrecoverable input", () => {
    const r = validateDecision(makeDecision({ id: "XXXX" }));
    expect(r.valid).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it("fails explicitly on missing required fields", () => {
    const r = validateDecision({ body: {} });
    expect(r.valid).toBe(false);
  });
});

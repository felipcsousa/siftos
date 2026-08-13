import { describe, expect, it } from "vitest";
import { nextDecisionId, decisionIdRank, MAX_DECISION_ID } from "../src/id.js";

describe("nextDecisionId", () => {
  it("starts at DEC-0001", () => {
    expect(nextDecisionId([])).toBe("DEC-0001");
  });

  it("increments the highest existing id (PRD §26)", () => {
    expect(nextDecisionId(["DEC-0001"])).toBe("DEC-0002");
    expect(nextDecisionId(["DEC-0002", "DEC-0005"])).toBe("DEC-0006");
    expect(nextDecisionId(["DEC-0042"])).toBe("DEC-0043");
  });

  it("never reuses a removed id", () => {
    // Removal leaves a gap; monotonicity means we still advance from max.
    expect(nextDecisionId(["DEC-0001", "DEC-0003"])).toBe("DEC-0004");
  });

  it("ignores malformed entries", () => {
    expect(nextDecisionId(["readme.md", "DEC-0009"])).toBe("DEC-0010");
  });

  it("throws when the id space is exhausted", () => {
    expect(() => nextDecisionId([`DEC-${String(MAX_DECISION_ID).padStart(4, "0")}`])).toThrow(
      /exhausted/,
    );
  });
});

describe("decisionIdRank", () => {
  it("returns the numeric rank", () => {
    expect(decisionIdRank("DEC-0042")).toBe(42);
    expect(decisionIdRank("nope")).toBe(-1);
  });
});

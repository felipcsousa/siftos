import { describe, expect, it } from "vitest";
import {
  classifyLevelDeterministic,
  classifyToolEffect,
  guardVerdict,
} from "../src/guard.js";

describe("classifyToolEffect (PRD V2 §64)", () => {
  it("reads are never gated", () => {
    expect(classifyToolEffect("read", ["src/x.ts"])).toBe("read");
    expect(classifyToolEffect("grep", ["pattern"])).toBe("read");
  });

  it("mutations are classified", () => {
    expect(classifyToolEffect("write", ["src/x.ts"])).toBe("mutation");
    expect(classifyToolEffect("edit", ["src/x.ts"])).toBe("mutation");
    expect(classifyToolEffect("bash", ["rm -rf dist"])).toBe("mutation");
  });

  it("SiftOS internal writes never recurse (PRD V2 §65)", () => {
    expect(classifyToolEffect("write", [".product/decisions/DEC-0001.md"])).toBe(
      "siftos_internal",
    );
    expect(classifyToolEffect("edit", [".agents/skills/siftos/SKILL.md"])).toBe(
      "siftos_internal",
    );
  });

  it("unknown tools stay unknown", () => {
    expect(classifyToolEffect("frobnicate", ["x"])).toBe("unknown");
  });
});

describe("classifyLevelDeterministic (fallback)", () => {
  it("L3 for strategic surfaces", () => {
    expect(classifyLevelDeterministic(["src/pricing.ts"])).toBe("L3");
    expect(classifyLevelDeterministic(["app/billing/plans.tsx"])).toBe("L3");
  });
  it("L2 for material features", () => {
    expect(classifyLevelDeterministic(["src/referrals.ts"])).toBe("L2");
    expect(classifyLevelDeterministic(["src/google-login.tsx"])).toBe("L2");
  });
  it("L1 for minor changes", () => {
    expect(classifyLevelDeterministic(["src/Button.css"])).toBe("L1");
    expect(classifyLevelDeterministic(["src/copy.ts"])).toBe("L1");
  });
  it("L0 for technical work", () => {
    expect(classifyLevelDeterministic(["test/foo.test.ts"])).toBe("L0");
    expect(classifyLevelDeterministic(["lib/query.ts"])).toBe("L0");
  });
  it("UNKNOWN for empty scope", () => {
    expect(classifyLevelDeterministic([])).toBe("UNKNOWN");
  });
});

describe("guardVerdict (deterministic gate)", () => {
  it("advisory never blocks", () => {
    for (const level of ["L0", "L1", "L2", "L3", "UNKNOWN"]) {
      expect(guardVerdict(level as never, "advisory")).toBe("ALLOW");
    }
  });

  it("balanced blocks L2/L3 once, allows the rest", () => {
    expect(guardVerdict("L0", "balanced")).toBe("ALLOW");
    expect(guardVerdict("L1", "balanced")).toBe("ALLOW");
    expect(guardVerdict("UNKNOWN", "balanced")).toBe("ALLOW");
    expect(guardVerdict("L2", "balanced")).toBe("BLOCK_ONCE");
    expect(guardVerdict("L3", "balanced")).toBe("BLOCK_ONCE");
  });

  it("strict hard-gates L2/L3/UNKNOWN and inspects L1", () => {
    expect(guardVerdict("L0", "strict")).toBe("ALLOW");
    expect(guardVerdict("L1", "strict")).toBe("ADVISE");
    expect(guardVerdict("L2", "strict")).toBe("REQUIRE_RESOLUTION");
    expect(guardVerdict("L3", "strict")).toBe("REQUIRE_RESOLUTION");
    expect(guardVerdict("UNKNOWN", "strict")).toBe("REQUIRE_RESOLUTION");
  });
});

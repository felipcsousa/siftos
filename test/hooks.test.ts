import { describe, expect, it } from "vitest";
import { buildCapsule, detectScopeDrift, LOGICAL_TO_CONFIG, runHook } from "../src/hooks.js";
import { resolveHooks } from "../src/config.js";
import { makeDecision, withSections } from "./helpers.js";

describe("LOGICAL_TO_CONFIG", () => {
  it("maps every logical event to a config hook", () => {
    expect(LOGICAL_TO_CONFIG["session.start"]).toBe("session_start");
    expect(LOGICAL_TO_CONFIG["mutation.before"]).toBe("before_mutation");
    expect(LOGICAL_TO_CONFIG["turn.stop"]).toBe("turn_stop");
    expect(LOGICAL_TO_CONFIG["subagent.start"]).toBe("subagent_start");
  });
});

describe("runHook envelope (PRD V2 §102–§104)", () => {
  it("skips disabled hooks without side effects", () => {
    const effective = resolveHooks({ repository: { preset: "off" } });
    let called = false;
    const out = runHook({
      name: "mutation.before",
      effective,
      handler: () => {
        called = true;
      },
    });
    expect(out).toEqual({ ran: false, ok: true, skipped: true });
    expect(called).toBe(false);
  });

  it("runs enabled hooks", () => {
    const effective = resolveHooks({ repository: { preset: "balanced" } });
    const out = runHook({
      name: "mutation.before",
      effective,
      handler: () => undefined,
    });
    expect(out.ran).toBe(true);
    expect(out.ok).toBe(true);
  });

  it("fail_open reports but does not fail (no silent failure)", () => {
    const effective = resolveHooks({ repository: { preset: "balanced" } });
    const out = runHook({
      name: "prompt.submit",
      effective,
      handler: () => {
        throw new Error("boom");
      },
    });
    expect(out.ok).toBe(true);
    expect(out.error).toMatch(/boom/);
  });

  it("fail_closed fails the hook", () => {
    const effective = resolveHooks({
      repository: {
        preset: "strict",
        before_mutation: { enabled: true, enforcement: "strict", failure_policy: "fail_closed" },
      },
    });
    const out = runHook({
      name: "mutation.before",
      effective,
      handler: () => {
        throw new Error("boom");
      },
    });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/fail_closed|boom/);
  });
});

describe("detectScopeDrift (PRD V2 §66–§68)", () => {
  const bet = withSections(makeDecision({ status: "building" }), {
    Scope: ["referral link", "invite flow"],
  });

  it("files inside scope are not drift", () => {
    expect(detectScopeDrift(bet, ["src/invite-flow.ts"])).toEqual([]);
  });

  it("unrelated files are drift", () => {
    expect(detectScopeDrift(bet, ["src/export.ts"])).toEqual(["src/export.ts"]);
    expect(detectScopeDrift(bet, ["src/invite-flow.ts", "src/export.ts"])).toEqual([
      "src/export.ts",
    ]);
  });

  it(".product files are never drift", () => {
    expect(detectScopeDrift(bet, [".product/decisions/DEC-0001.md"])).toEqual([]);
  });

  it("no scope defined -> nothing to compare (missing-scope linter covers it)", () => {
    const noScope = makeDecision({ status: "building" });
    expect(detectScopeDrift(noScope, ["src/anything.ts"])).toEqual([]);
  });
});

describe("buildCapsule (PRD V2 §54, §77, §79)", () => {
  it("includes product context, active bet scope, and guard preset", () => {
    const capsule = buildCapsule({
      product: "# Product\n\n## Name\n\nSiftOS\n",
      strategy: "",
      metrics: "",
      principles: "",
      activeBet: withSections(
        makeDecision({ id: "DEC-0014", title: "Onboarding friction", status: "building" }),
        { Scope: ["remove phone"], "Non-Goals": ["redesign onboarding"] },
      ),
      guardPreset: "balanced",
    });
    expect(capsule).toContain("SiftOS");
    expect(capsule).toContain("Active bet: DEC-0014 — Onboarding friction (building)");
    expect(capsule).toContain("- remove phone");
    expect(capsule).toContain("- redesign onboarding");
    expect(capsule).toContain("Guard preset: balanced");
  });
});

import { describe, expect, it } from "vitest";
import { validateTransition, STATUS_ORDER } from "../src/status.js";

describe("validateTransition", () => {
  const ok = (from: (typeof STATUS_ORDER)[number], to: (typeof STATUS_ORDER)[number]) => {
    expect(validateTransition(from, to).ok, `${from} → ${to}`).toBe(true);
  };
  const bad = (from: (typeof STATUS_ORDER)[number], to: (typeof STATUS_ORDER)[number]) => {
    expect(validateTransition(from, to).ok, `${from} → ${to}`).toBe(false);
  };

  it("allows the main flow", () => {
    ok("draft", "proposed");
    ok("proposed", "accepted");
    ok("accepted", "shipped");
    ok("shipped", "reviewed");
  });

  it("allows alternates", () => {
    ok("proposed", "rejected");
    ok("accepted", "cancelled");
    ok("accepted", "superseded");
    ok("shipped", "superseded");
  });

  it("allows identity", () => {
    ok("draft", "draft");
    ok("reviewed", "reviewed");
  });

  it("rejects invalid transitions", () => {
    bad("draft", "accepted");
    bad("proposed", "shipped");
    bad("accepted", "reviewed");
    bad("reviewed", "shipped");
    bad("rejected", "accepted");
    bad("cancelled", "shipped");
    bad("superseded", "reviewed");
    bad("draft", "rejected");
  });

  it("reports the allowed set in the reason", () => {
    const r = validateTransition("draft", "shipped");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("proposed");
  });
});

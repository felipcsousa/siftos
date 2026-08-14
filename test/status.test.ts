import { describe, expect, it } from "vitest";
import { STATUS_ORDER, validateTransition } from "../src/status.js";

describe("v0.2 transitions are preserved", () => {
  const pairs: Array<[string, string]> = [
    ["draft", "proposed"],
    ["proposed", "accepted"],
    ["proposed", "rejected"],
    ["accepted", "shipped"],
    ["accepted", "cancelled"],
    ["accepted", "superseded"],
    ["shipped", "reviewed"],
    ["shipped", "superseded"],
  ];
  for (const [from, to] of pairs) {
    it(`${from} -> ${to}`, () => {
      expect(validateTransition(from as never, to as never).ok).toBe(true);
    });
  }
});

describe("V2 bet stretch", () => {
  const pairs: Array<[string, string]> = [
    ["draft", "shaping"],
    ["shaping", "validating"],
    ["validating", "ready"],
    ["ready", "accepted"],
    ["accepted", "building"],
    ["building", "shipped"],
    ["shipped", "measuring"],
    ["measuring", "reviewed"],
    ["building", "paused"],
    ["paused", "building"],
    ["building", "failed"],
    ["measuring", "failed"],
  ];
  for (const [from, to] of pairs) {
    it(`${from} -> ${to}`, () => {
      expect(validateTransition(from as never, to as never).ok).toBe(true);
    });
  }
});

describe("invalid transitions", () => {
  const pairs: Array<[string, string]> = [
    ["draft", "accepted"],
    ["ready", "shipped"],
    ["reviewed", "shipped"],
    ["shaping", "accepted"],
    ["failed", "building"],
    ["superseded", "accepted"],
    ["rejected", "validating"],
  ];
  for (const [from, to] of pairs) {
    it(`${from} -> ${to} rejected`, () => {
      const r = validateTransition(from as never, to as never);
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/invalid transition/);
    });
  }
});

it("same-status transition is a no-op success", () => {
  expect(validateTransition("building", "building").ok).toBe(true);
});

it("STATUS_ORDER includes every V2 state in lifecycle order", () => {
  expect(STATUS_ORDER).toEqual([
    "draft",
    "shaping",
    "validating",
    "ready",
    "proposed",
    "accepted",
    "building",
    "shipped",
    "measuring",
    "reviewed",
    "rejected",
    "cancelled",
    "paused",
    "failed",
    "superseded",
  ]);
});

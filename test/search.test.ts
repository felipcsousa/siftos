import { describe, expect, it } from "vitest";
import { matchesQuery, matchesFilters, searchDecisions, searchableText } from "../src/search.js";
import { makeDecision, withSections, NOW } from "./helpers.js";

const d1 = withSections(
  makeDecision({ id: "DEC-0042", title: "Remove credit card from trial", tags: ["onboarding"], goal: "improve-activation", owner: "joao", status: "accepted", reviewDate: "2026-09-13" }),
  { Facts: ["38% abandon at the payment step."] },
);
const d2 = makeDecision({ id: "DEC-0001", title: "Add Google login", tags: ["auth"], goal: "improve-activation", owner: "ana", status: "proposed", reviewDate: "2026-07-01" });

describe("matchesQuery", () => {
  it("matches on title, body, tags, owner and id", () => {
    expect(matchesQuery(d1, "credit card")).toBe(true);
    expect(matchesQuery(d1, "38%")).toBe(true);
    expect(matchesQuery(d1, "onboarding")).toBe(true);
    expect(matchesQuery(d1, "joao")).toBe(true);
    expect(matchesQuery(d2, "DEC-0001")).toBe(true);
    expect(matchesQuery(d1, "google")).toBe(false);
  });

  it("requires all tokens", () => {
    expect(matchesQuery(d1, "remove card")).toBe(true);
    expect(matchesQuery(d1, "remove google")).toBe(false);
  });
});

describe("matchesFilters", () => {
  it("filters by status, tag, owner, goal", () => {
    expect(matchesFilters(d1, { status: "accepted" })).toBe(true);
    expect(matchesFilters(d1, { status: "proposed" })).toBe(false);
    expect(matchesFilters(d1, { tag: "onboarding" })).toBe(true);
    expect(matchesFilters(d1, { owner: "joao" })).toBe(true);
    expect(matchesFilters(d1, { goal: "improve-activation" })).toBe(true);
  });

  it("pending-review only surfaces open decisions with expired dates", () => {
    expect(matchesFilters(d2, { pendingReview: true, now: NOW })).toBe(false); // proposed is not open
    const open = makeDecision({ status: "accepted", reviewDate: "2026-07-01" });
    expect(matchesFilters(open, { pendingReview: true, now: NOW })).toBe(true);
    const future = makeDecision({ status: "accepted", reviewDate: "2026-09-01" });
    expect(matchesFilters(future, { pendingReview: true, now: NOW })).toBe(false);
    const noDate = makeDecision({ status: "accepted" });
    expect(matchesFilters(noDate, { pendingReview: true, now: NOW })).toBe(false);
  });
});

describe("searchDecisions", () => {
  it("combines query and filters, sorted by id", () => {
    const out = searchDecisions([d1, d2], "activation", { goal: "improve-activation" });
    expect(out.map((d) => d.id)).toEqual(["DEC-0001", "DEC-0042"]);
  });

  it("returns everything when no query or filters", () => {
    expect(searchDecisions([d1, d2], undefined, {})).toHaveLength(2);
  });
});

describe("searchableText", () => {
  it("includes metadata and body", () => {
    const text = searchableText(d1);
    expect(text).toContain("dec-0042");
    expect(text).toContain("38% abandon");
  });
});

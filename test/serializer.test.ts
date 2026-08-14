import { describe, expect, it } from "vitest";
import { serializeDecision } from "../src/serializer.js";
import { parseDecision } from "../src/parser.js";
import { makeDecision, withSections, cleanDecision } from "./helpers.js";

import { DECISION_SECTIONS, OUTCOME_SECTIONS } from "../src/types.js";

const CANONICAL = [...DECISION_SECTIONS, ...OUTCOME_SECTIONS];

describe("serializeDecision", () => {
  it("emits frontmatter in canonical order and omits empties", () => {
    const md = serializeDecision(
      makeDecision({ tags: ["a"], owner: "joao", reviewDate: null }),
    );
    const lines = md.split("\n");
    const fm = lines.slice(1, lines.indexOf("---", 1));
    expect(fm[0]).toBe("id: DEC-0001");
    expect(fm[1]).toBe("title: Test decision");
    expect(fm[2]).toBe("status: accepted");
    expect(fm.join("\n")).not.toContain("goal:");
    expect(md).toContain("review_date: null");
  });

  it("emits bet_class when set", () => {
    const md = serializeDecision(makeDecision({ betClass: "offense" }));
    expect(md).toContain("bet_class: offense");
  });

  it("emits Unknown. for empty canonical sections", () => {
    const md = serializeDecision(makeDecision());
    expect(md).toContain("## Context\n\nUnknown.");
    expect(md).toContain("## Alternatives Rejected\n\nUnknown.");
    expect(md).toContain("## Observed Result\n\nUnknown.");
  });

  it("emits bullets for filled sections", () => {
    const md = serializeDecision(
      withSections(makeDecision(), { Facts: ["a", "b"] }),
    );
    expect(md).toContain("## Facts\n\n- a\n- b");
  });

  it("preserves non-canonical sections after canonical ones", () => {
    const md = serializeDecision(
      withSections(makeDecision(), { "Future Work": ["x"] }),
    );
    expect(md.indexOf("## Future Work")).toBeGreaterThan(md.indexOf("## Follow-up Decisions"));
    expect(md).toContain("## Future Work\n\n- x");
  });
});

describe("round-trip", () => {
  it("parse(serialize(d)) deep-equals d (canonical sections expanded)", () => {
    const d = cleanDecision();
    const reparsed = parseDecision(serializeDecision(d));
    const expectedBody = { ...d.body };
    for (const section of CANONICAL) {
      if (!(section in expectedBody)) expectedBody[section] = [];
    }
    expect(reparsed).toEqual({ ...d, body: expectedBody });
  });

  it("round-trips sparse decisions (canonical sections expand to empty)", () => {
    const d = makeDecision({ status: "draft" });
    const reparsed = parseDecision(serializeDecision(d));
    const { id, title, status, createdAt, updatedAt, tags, body } = reparsed;
    expect({ id, title, status, createdAt, updatedAt, tags }).toEqual({
      id: d.id,
      title: d.title,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      tags: d.tags,
    });
    expect(Object.keys(body).sort()).toEqual(CANONICAL.slice().sort());
    expect(Object.values(body).every((v) => v.length === 0)).toBe(true);
  });

  it("round-trips bet_class", () => {
    const d = makeDecision({ betClass: "defense" });
    expect(parseDecision(serializeDecision(d)).betClass).toBe("defense");
    const absent = makeDecision();
    expect(parseDecision(serializeDecision(absent)).betClass).toBeUndefined();
  });

  it("keeps supersession links", () => {
    const d = makeDecision({
      status: "superseded",
      supersedes: "DEC-0001",
      supersededBy: "DEC-0002",
    });
    expect(parseDecision(serializeDecision(d)).supersededBy).toBe("DEC-0002");
    expect(parseDecision(serializeDecision(d)).supersedes).toBe("DEC-0001");
  });
});

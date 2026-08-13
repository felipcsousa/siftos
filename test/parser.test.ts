import { describe, expect, it } from "vitest";
import { parseDecision, ParseError, splitFrontmatter, parseBody } from "../src/parser.js";

const GOOD = `---
id: DEC-0042
title: Remove mandatory credit card from trial
status: accepted

created_at: 2026-08-13
updated_at: 2026-08-13

owner: joao

tags:
  - onboarding
  - activation

goal: improve-activation
bet_class: offense
confidence: medium
review_date: 2026-09-13
supersedes: null
agent_workflow_version: decide-v1
---

# Decision

## Context

Self-service signup requires a credit card.

## Facts

- 38% of users abandon at the payment step.
- Current activation is 24%.

## Unknowns

Unknown.
`;

describe("splitFrontmatter", () => {
  it("parses scalars, lists, nulls and quotes", () => {
    const { fields } = splitFrontmatter(`---
a: 1
b: hello: world
tags:
  - one
  - two
c: null
d: "quoted"
---

# body
`);
    expect(fields["a"]).toBe("1");
    expect(fields["b"]).toBe("hello: world");
    expect(fields["tags"]).toEqual(["one", "two"]);
    expect(fields["c"]).toBeNull();
    expect(fields["d"]).toBe("quoted");
  });

  it("throws on missing delimiter", () => {
    expect(() => splitFrontmatter("no frontmatter here")).toThrow(ParseError);
    expect(() => splitFrontmatter("---\nid: x\n")).toThrow(/unterminated/);
  });

  it("throws on malformed lines", () => {
    expect(() => splitFrontmatter("---\nno colon\n---")).toThrow(ParseError);
  });
});

describe("parseBody", () => {
  it("collects bullets per section and skips part headings", () => {
    const body = parseBody(`# Decision

## Facts

- alpha
- beta

## Unknowns

Unknown.
`);
    expect(body["Facts"]).toEqual(["alpha", "beta"]);
    expect(body["Unknowns"]).toEqual([]); // "Unknown." normalizes to empty
  });

  it("appends prose continuation to the last bullet", () => {
    const body = parseBody(`## Evidence

- Claim: x

continuation line
`);
    expect(body["Evidence"]).toEqual(["Claim: x continuation line"]);
  });

  it("preserves unknown sections", () => {
    const body = parseBody(`## Future Work

- something
`);
    expect(body["Future Work"]).toEqual(["something"]);
  });
});

describe("parseDecision", () => {
  it("parses a full decision", () => {
    const d = parseDecision(GOOD);
    expect(d.id).toBe("DEC-0042");
    expect(d.title).toBe("Remove mandatory credit card from trial");
    expect(d.status).toBe("accepted");
    expect(d.owner).toBe("joao");
    expect(d.tags).toEqual(["onboarding", "activation"]);
    expect(d.goal).toBe("improve-activation");
    expect(d.betClass).toBe("offense");
    expect(d.confidence).toBe("medium");
    expect(d.reviewDate).toBe("2026-09-13");
    expect(d.supersedes).toBeNull();
    expect(d.agentWorkflowVersion).toBe("decide-v1");
    expect(d.body["Context"]).toEqual(["Self-service signup requires a credit card."]);
    expect(d.body["Facts"]).toHaveLength(2);
  });

  it("defaults status to draft and omits missing fields", () => {
    const d = parseDecision(`---
id: DEC-0001
title: T
created_at: 2026-01-01
updated_at: 2026-01-01
---

# Decision
`);
    expect(d.status).toBe("draft");
    expect(d.owner).toBeUndefined();
    expect(d.reviewDate).toBeUndefined();
  });

  it("rejects invalid ids", () => {
    expect(() =>
      parseDecision(`---
id: DEC-42
title: T
created_at: 2026-01-01
updated_at: 2026-01-01
---

# Decision
`),
    ).toThrow(/invalid id/);
  });

  it("rejects missing required fields", () => {
    expect(() =>
      parseDecision(`---
id: DEC-0001
created_at: 2026-01-01
updated_at: 2026-01-01
---

# Decision
`),
    ).toThrow(/title/);
    expect(() =>
      parseDecision(`---
id: DEC-0001
title: T
updated_at: 2026-01-01
---

# Decision
`),
    ).toThrow(/created_at/);
  });
});

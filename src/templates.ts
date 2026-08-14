/** Init scaffold content (PRD §§17–21). Missing information stays "Unknown." (NFR-009). */

export const PRODUCT_TEMPLATE = `# Product

## Name

Unknown.

## Description

Unknown.

## Primary customer

Unknown.

## Primary jobs to be done

Unknown.

## Business model

Unknown.

## Product stage

Unknown.

## Positioning

Unknown.

## Current constraints

Unknown.

## Non-goals

Unknown.

## Relevant systems

Unknown.

## Additional context

Unknown.
`;

export const STRATEGY_TEMPLATE = `# Product Strategy

## Current strategic objective

Unknown.

## Strategic context

Unknown.

## Target customer

Unknown.

## Strategic bets

Unknown.

## Competitive advantages

Unknown.

## Constraints

Unknown.

## Explicit non-priorities

Unknown.

## Strategic questions

Unknown.
`;

export const METRICS_TEMPLATE = `# Metrics

## Primary outcome

Metric:
Unknown.

Definition:
Unknown.

Baseline:
unknown

Target:
Unknown.

## Activation

Metric:
Unknown.

Definition:
Unknown.

Baseline:
unknown

Target:
Unknown.

## Retention

Metric:
Unknown.

Definition:
Unknown.

Baseline:
unknown

Target:
Unknown.

## Revenue

Metric:
Unknown.

Definition:
Unknown.

Baseline:
unknown

Target:
Unknown.

## Guardrails

Unknown.
`;

export const PRINCIPLES_TEMPLATE = `# Product Principles

Unknown.
`;

export const DECISIONS_README = `# Decisions

Product Decision Records (PDRs) live here as \`DEC-XXXX-slug.md\`.

- One file per decision.
- The ID is permanent and never reused.
- Create records with the \`decide\` workflow (or \`siftos next-id\` + the
  DECISION template); never hand-edit an ID.
- Reaching \`accepted\` requires an explicit human decision.
`;

export const EVIDENCE_README = `# Evidence

Supporting material for decisions may live in this directory.

A decision file itself records inline evidence with provenance:

    - Claim: <claim> | Source: <source> | Date: <YYYY-MM-DD>

\`Source: unspecified\` is a valid value. Never invent a source.
`;

export const CONFIG_TEMPLATE = JSON.stringify(
  {
    version: 2,
    name: "siftos",
    platforms: ["opencode", "codex"],
    linters: { enabled: true },
    // PRD V2 §43: minimal until customized. New repositories default to
    // `balanced`; upgraded v0.2 repositories keep hooks absent (disabled)
    // until the user explicitly chooses a preset (PRD V2 §45/§186).
    hooks: { preset: "balanced" },
  },
  null,
  2,
) + "\n";

export const ROADMAP_TEMPLATE = `# Product Roadmap

Only active bets belong on the roadmap (PRD V2 §92). A bet is a product
investment under uncertainty; keep it here while it is being shaped,
validated, built, or measured.

## NOW

Unknown.

## NEXT

Unknown.

## LATER

Unknown.

## NOT NOW

Unknown.
`;


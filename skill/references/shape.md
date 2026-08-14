# Shape — idea → Bet (PRD V2 §88)

Transforms an idea into a structured bet. A bet is a record in the
pre-acceptance stretch of the lifecycle (`draft → shaping → validating →
ready`). The human decides; the agent structures.

## Input

```text
/siftos shape we want to add referrals
```

or any idea description.

## Flow

1. Load product context (`scripts/context.mjs` equivalent: PRODUCT.md,
   STRATEGY.md, METRICS.md, PRINCIPLES.md).
2. Retrieve related decisions/bets (context compiler) — never start from
   zero.
3. Build the bet record (status `shaping`; `shaping → validating` when
   the SVT is defined). Use `scripts/next-decision-id.mjs` for the ID.
4. Fill, in order:

```text
Context
Goal
Target User
Hypothesis
Facts
Evidence
Assumptions
Unknowns
Options Considered
Alternatives Rejected
SVT
Scope
Non-Goals
Primary Metric
Expected Outcome
What Would Change Our Mind
Revisit Condition
```

Missing information stays `Unknown.` (NFR-009).

## SVT — Smallest Valuable Test

> The smallest credible intervention capable of materially reducing the
> most important uncertainty.

The SVT may require zero code: interview, fake door, prototype, concierge,
manual process, pre-sale, technical spike, controlled experiment. If the
idea cannot name an SVT, it is not ready to leave `shaping`.

## Measurement

Before `validating`, define:

```text
Primary Metric
Baseline (from METRICS.md; unknown is valid but explicit)
Expected Outcome (quantified when possible)
Guardrails (quantified threshold)
Revisit Condition
```

## Exit criteria

- `shaping → validating` requires: problem, target user, hypothesis, SVT.
- `validating → ready` requires: validation contract thresholds
  (see `validate.md`).
- `ready → accepted` requires an explicit human decision.

Never move a record to `accepted` without the human. Never invent
evidence or baselines.

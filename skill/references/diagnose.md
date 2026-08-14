# Diagnose — product health, novice-friendly (PRD V2 §93)

Evaluates the repository's product state and identifies only the
highest-leverage issues. Not a checklist dump.

## Input

```text
/siftos diagnose
```

## Dimensions

```text
ICP clarity
Strategy
Goal
Constraint
Metrics
Feature breadth
Evidence
Bets
Roadmap
Measurement
Review discipline
```

## Output

```text
Overall: <one line>

Highest-leverage issues:
1. <issue> — <evidence> — <cheapest next step>
2. ...

Working well:
- ...
```

Rules:

- At most 3 issues. More than that is noise.
- Every issue cites evidence (a missing baseline in METRICS.md, a bet
  without an SVT, reviewed-rate 0 in audit, ...).
- Every issue names the cheapest next step (often `siftos shape`,
  `siftos validate`, or a METRICS.md edit).
- `Unknown.` is a legitimate finding for missing context; never invent.
- Do not prescribe frameworks. Do not turn the diagnosis into a
  14-field form.

## Evidence sources

`scripts/audit.mjs` (reviewed rate, missing metrics, missing
alternatives), `scripts/status.mjs` (stale bets), METRICS.md baselines,
PRINCIPLES.md conflicts, ROADMAP.md currency.

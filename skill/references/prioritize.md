# Prioritize — ranking bets (PRD V2 §91)

Ranks candidate bets. No mandatory RICE/ICE score — judgment over
frameworks (v0.2 §11.7). Scores are auxiliary and never replace argument.

## Input

```text
/siftos prioritize
```

## Criteria

Weigh, in plain language, each candidate bet against:

```text
Strategic fit        Does it move the current strategic objective?
Current constraint   Does it relieve the current constraint?
Expected upside      Directional, not false precision.
Evidence strength    Existing evidence for the bet.
Cost                 Build and ongoing cost, directional.
Cost of delay        What is lost by waiting?
Reversibility        Cost of undoing it.
Learning value       What it teaches even on failure.
Dependencies         What blocks it / what it unblocks.
```

## Output

A ranked list with one-line reasoning per bet, then a recommendation of
the top 1–2 with the reasoning spelled out. Do not rank by unweighted
counts of criteria.

## Constraint first

Read STRATEGY.md and METRICS.md. If the current constraint is activation,
a bet that relieves activation beats an equal-expected-upside bet that
does not — say so explicitly.

## Non-goals

Prioritize does not create a roadmap (see `roadmap.md`) and does not
decide for the human. It proposes; the human picks.

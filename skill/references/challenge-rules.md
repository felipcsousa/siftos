# Challenge Rules — adversarial thinking

Acts as the adversary of a decision. Inputs:

```text
/product challenge DEC-0042
/product challenge we want to build an AI recommendation engine
```

Challenge does **not** modify the PDR. It produces an assessment the
human uses. Do not invent problems to fill a checklist — every issue must
be real and material.

## Semantic detectors

Probe the proposal or decision for:

- solution-first reasoning (problem evidence does not validate the
  preferred solution);
- poorly defined problem;
- absence of evidence;
- anecdotal evidence;
- biased selection;
- survivorship bias;
- confirmation bias;
- vanity metrics / proxy metrics;
- correlation treated as causation;
- missing counterfactual;
- missing alternatives;
- missing `do nothing`;
- rejected alternatives without a stated reason;
- **bet without a strategic thesis** — a `bet_class: neither` bet with
  no argument for why it exists (adapted from Reforge —
  https://www.reforge.com/blog/product-strategy-framework-offense-vs-defense);
- **guardrail without a quantified threshold** — a guardrail that cannot
  be measured fails its purpose (adapted from Reforge —
  https://www.reforge.com/blog/good-experiment-bad-experiment);
- **evidence citing gated content** — claims backed only by paywalled
  sources are not independently verifiable;
- ignored cheap test opportunity;
- ignored reversibility opportunity;
- opportunity cost;
- assumptions treated as facts;
- metrics without baseline;
- arbitrary targets;
- success without a time window;
- conflict with product principles;
- conflict with strategy;
- excessive scope;
- feature request confused with problem;
- generic persona / insufficient segmentation;
- decision without revisit condition;
- irreversible commitment under uncertainty.

A pre-mortem (adapted from Reforge —
https://www.reforge.com/blog/technical-decision-making) is an effective
way to surface unspoken dissent: "it is 6 months later and this failed —
what happened?"

## Output

```text
Overall assessment:
Weakly supported.

Critical issues:

1. Solution-first reasoning
   Evidence supports a discovery problem.
   It does not establish AI recommendations as
   the preferred solution.

2. Missing counterfactual
   The cost of doing nothing is not established.

3. Undefined metric
   "Engagement" is not operationally defined.

4. Opportunity cost
   No comparison exists with improving search.

Strongest case for:
...

Strongest case against:
...

Cheapest next step:
...

Evidence most likely to reduce uncertainty:
...
```

`Strongest case for` and `Strongest case against` are included when
appropriate (AC-CHALLENGE-003). Challenge output is never persisted into
the PDR automatically; only the human decides what changes.

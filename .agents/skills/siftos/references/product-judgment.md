# Product Judgment — shared principles (V0.4)

The single reference behind `prioritize`, `critique`, `align` and the
product-aware implementation preflight. Read this before any of them.
Its purpose is to keep the judgment consistent across capabilities and to
prevent the deterministic core from ever substituting for judgment.

## The ten principles

1. **Current constraint beats generic opportunity.** A bet that relieves
   the current constraint wins over an equal-upside bet that does not.
   Name the constraint explicitly; if you cannot name one, say so.
2. **Evidence strength affects investment size.** Strong evidence lets you
   commit; weak evidence forces you to shrink the investment. Never size a
   build like the hypothesis is proven when it is not.
3. **Reversibility affects required certainty.** Irreversible moves need
   higher certainty; reversible moves can be tried with less. Cost of error
   scales with irreversibility.
4. **Cheapest credible learning before expensive commitment.** If a cheap
   test materially reduces the key uncertainty, the test comes before the
   build. "Cheapest" includes time, not just dollars.
5. **Problem before solution.** The problem must exist and matter before the
   solution deserves a design. A sophisticated solution to an unproven
   problem is scope, not judgment.
6. **Expected outcome must be observable.** If we cannot tell success from
   failure afterward, the bet cannot be learned from. Define the observable
   threshold even when you do not formalize a contract.
7. **Historical evidence beats generic best practice when relevant.** This
   product's own prior decisions, experiments and learnings outweigh
   generic playbooks — when they are relevant. Do not cite history that
   does not apply; do not ignore history that does.
8. **Strategic contradiction must be explicit.** When new work conflicts
   with a prior decision or the current strategy, say it in plain language.
   An intentional strategy change supersedes the old decision explicitly;
   it is never silently ignored.
9. **User value matters more than framework completeness.** A judgment that
   helps the user decide beats a complete taxonomy. Never block on missing
   fields, missing files or unrun workflows.
10. **No framework score substitutes judgment.** Scores are directional
    aids, never gates, never KPIs. When a score and judgment disagree,
    judgment wins and the score is challenged, not the user.

## Persistence rule

> The value of remembering must exceed the cost of future retrieval.

Before writing anything durable, ask: "Is there a reasonable probability
this information changes a future decision?" If not, do not persist it.
Exploration and brainstorming are never memory.

## Product-surface rule

> Never expose an internal concept when a user intention is enough.

The machine may stay sophisticated; the interface speaks work.

- Not: "Run a validation contract."
- Instead: "Define what result would prove this before seeing the data."
- Not: "Attach to an accepted bet."
- Instead: "This is already covered by the onboarding initiative."

## Confidence protocol

`Unknown.` is a legitimate state. Missing context lowers confidence and
shapes the recommendation; it never interrupts utility. State what is
missing and how the recommendation changes if the missing fact is wrong.

```text
Bad:  "METRICS.md has Unknown activation baseline. Please initialize SiftOS first."
Good: "I'd favor A, but confidence is medium because I couldn't find an
       activation baseline. If activation is still the current constraint,
       A dominates B."
```

## Distinctions

| Tool | Question | Object |
|---|---|---|
| `prioritize` | What should we do? | Candidates |
| `critique` | Is this actually good? | The current work artifact |
| `align` | Does this make sense for this product? | The change vs product memory |
| `diagnose` | What is wrong with the product overall? | The product state |
| `review` | What did we actually learn? | Prediction vs outcome |

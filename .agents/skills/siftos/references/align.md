# Align — does this change make sense for this product? (V0.4)

**Hero capability.** The purest expression of the SiftOS moat: it checks
today's change against the product's own strategy, prior decisions and
learnings. A generic agent answers "what does the user want"; align answers
"does this make sense given everything we know about this product?"

## When to use

Any moment the user is about to build, approve or merge something:

- an idea;
- a spec;
- an issue;
- a PR;
- a git diff;
- a feature;
- an implementation plan;
- a conversation excerpt.

Triggers: "does this PR make sense given our activation goal?", "should we
ship this?", "is this aligned with our strategy?", "we're about to change
X — any conflicts?"

## Flow

1. Understand the change and its materiality. Trivial/technical changes get
   no ceremony (see Ceremony Budget).
2. Retrieve only relevant product context: current objective, current
   constraint, relevant prior decisions, relevant learnings, applicable
   principles.
3. Compare the change against that context.
4. State the verdict and the reason in plain language. No score.

## Output

No score. Verdict first, context second, correction last:

```text
ALIGNMENT: TENSION

Relevant context
- Current objective: improve activation.
- DEC-0018 explicitly deferred monetization changes until activation baseline.
- Last onboarding experiment suggests the biggest loss is before account creation.

Tension
This PR adds a paid-plan chooser before activation. That moves monetization
earlier in exactly the funnel we are currently trying to reduce.

Recommendation
Do not merge this interaction as-is.

Cheapest correction
Keep plan selection after first value and instrument exposure → activation.

If this is an intentional strategy change, the previous monetization decision
should be superseded rather than silently ignored.
```

## Verdicts

```text
ALIGNED                no conflict with strategy, decisions or learnings
TENSION                partial conflict; correctable
CONFLICT               contradicts a prior decision or the current strategy
INSUFFICIENT CONTEXT   not enough product context to judge — say what is missing
```

None of them blocks execution technically. Align advises; the human decides.

## Rules

- Never invent context: if there is no prior decision on the matter, say so
  instead of fabricating one.
- An intentional strategy change supersedes the old decision explicitly —
  it is never silently ignored.
- Keep it short: context lines, one tension, one recommendation, one
  cheapest correction.

## Product-aware implementation preflight (FR-006)

When the user directly requests a material implementation:

> "Add mandatory credit card to trial."

Do not create a record and do not block. Run a brief preflight — only if
relevant context exists — then follow the user's request:

```text
This touches activation, which is the current constraint.

Existing context points the other way: the current onboarding bet is trying
to reduce pre-value friction. I would not make card collection mandatory
without an experiment.

If the intent is still to implement it, I can do so; I'd keep it reversible
and instrument the activation delta.
```

The preflight occupies a few lines, never a ceremony. After it, execute the
user's request as given. Reuse the existing L0–L3 classifier internally to
decide when a preflight is likely relevant; the user never needs to know
the level.

## Distinctions

- `align` = does the change fit this product's memory?
- `critique` = is the artifact itself good?
- `prioritize` = what should we do next?

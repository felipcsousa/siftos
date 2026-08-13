# Review Protocol — decision → outcome → learning

Closes the loop. The north-star metric of SiftOS is the Reviewed Decision
Rate: saving decisions without reviewing them creates documentation;
reviewing them creates learning.

## Input

```text
/product review DEC-0042
```

## Flow

1. Load the decision and its original prediction.
2. Load context (PRODUCT.md, STRATEGY.md, PRINCIPLES.md, METRICS.md).
3. Load the primary metric, guardrails, assumptions and revisit
   condition from the PDR.
4. Ask the user only for missing outcome information. Never invent an
   outcome.
5. Compare prediction with reality. The original prediction is preserved
   **verbatim** — never rewrite it to fit the result (hindsight bias).

## Structure

```text
Original Decision

Original Prediction

Observed Outcome

Prediction Accuracy

Guardrails

Unexpected Effects

Assumptions Confirmed

Assumptions Invalidated

Decision Assessment

Learnings

Recommended Changes

Follow-up Decisions
```

## Decision Assessment

Separate process quality from outcome quality:

```text
Good decision / good outcome
Good decision / bad outcome
Weak decision / bad outcome
Weak decision / good outcome
Inconclusive
```

A rational decision can produce a bad outcome; a bad decision can be
lucky. Assess both axes.

## Prediction Accuracy

```text
Expected:
Activation +8–15%

Actual:
+13.2%

Assessment:
Inside expected range.
```

```text
Expected:
Activation +8–15%

Actual:
+1.9%

Assessment:
Materially below expectation.
```

No sophisticated statistical modeling required in V1. Over time, track
hypothesis accuracy (expected vs actual across decisions) as a system
metric (adapted from Reforge —
https://www.reforge.com/blog/growth-experiment-management-system).

## Learnings

Review produces candidate learnings. Structure each one so it can be
reused (adapted from Reforge's learning-capture format —
https://www.reforge.com/blog/growth-experiment-management-system):

```text
Candidate learning:

Observation:
Cardless trials activated at the same rate.

Interpretation:
Payment friction was real for this segment.

Updated belief:
Mandatory payment information suppresses activation
without improving conversion quality.

Implication:
Reconsider mandatory card; watch trial quality.

Next hypothesis:
Removing the card improves activation without
materially reducing trial-to-paid.
```

If the same learning appears across three reviewed decisions, suggest
promoting it to PRINCIPLES.md — never promote automatically.

## State transition

On completion, transition the decision to `reviewed` (when the human
confirms the outcome record). Keep `Expected Outcome` untouched.

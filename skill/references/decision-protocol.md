# Decision Protocol — `decide`

Structures a real decision and produces a grounded recommendation.
Target: the first true value moment. Keep it fast; the user does not fill
forms — SiftOS generates Markdown from a structured analysis.

## Input

Natural language, e.g.:

```text
should we remove the credit card requirement from trial?
```

## Flow

1. Interpret the decision.
2. Load persistent context: PRODUCT.md → STRATEGY.md → PRINCIPLES.md →
   METRICS.md → related historical decisions (use
   `scripts/search.mjs` and `scripts/status.mjs`; the CLI equivalent
   `siftos context` compiles the same package with provenance).
3. Identify the goal.
4. **Classify the bet** (adapted from Reforge's offense/defense framing —
   https://www.reforge.com/blog/product-strategy-framework-offense-vs-defense):
   is this `offense` (moves the business forward, compounding),
   `defense` (protects existing value), or `neither` (no strategic
   thesis)? Record it in `bet_class`.
5. Separate Facts (observed/established), Evidence (observations
   supporting or contradicting a hypothesis), Inferences (derived
   conclusions), Assumptions (necessary, unestablished), Unknowns.
6. Generate alternatives; include `Do nothing` when relevant. Document
   rejected alternatives with the reason they were rejected
   (`Alternatives Rejected`).
7. **State the hypothesis as a causal claim** (adapted from Reforge's
   experiment system —
   https://www.reforge.com/blog/growth-experiment-management-system and
   https://www.reforge.com/blog/you-cannot-be-data-driven-without-experimentation):

   ```text
   We believe [segment] suffers from [problem] because [reason].
   If [change], then [behavior] because [mechanism].
   We expect [primary metric] to move from [baseline] to [value ± magnitude]
   without harming [guardrails].
   ```

   Every link in the chain must be checkable; an uncheckable link belongs
   in `Unknowns`.
8. Evaluate trade-offs, reversibility (high/medium/low), cost of delay
   (low/medium/high/unknown).
9. Produce a recommendation with confidence (low/medium/high).
10. Produce the strongest argument against the recommendation — an
    objection that could actually change the decision.
11. For low/medium confidence, state what would change our mind
    (falsifiability). Also answer the information-value question
    (adapted from Reforge — https://www.reforge.com/blog/roi-of-testing):
    "what would we do if this worked / failed, and what evidence would
    make this decision clearly better?" If the answer does not change
    any downstream action, testing it is waste.
12. Suggest expected outcome, primary metric, guardrails, revisit
    condition (date-, sample-, event- or outcome-based). Guardrails are
    pre-committed cross-metric tradeoffs: which metrics must NOT regress,
    each with a quantified threshold.
13. Get the human decision. Divergence is valid; record it without
    pressuring.
14. Validate, assign the next ID via `scripts/next-decision-id.mjs`,
    persist the PDR.

## Output structure

Every section below; empty sections serialize as `Unknown.`:

```text
Decision
Recommendation
Confidence
Context
Goal
Facts
Evidence
Inferences
Assumptions
Unknowns
Options Considered
Alternatives Rejected
Trade-offs
Recommendation Rationale
Strongest Argument Against
Expected Outcome
Primary Metric
Guardrails
Reversibility
Cost of Delay
What Would Change This Recommendation
Revisit Condition
Final Human Decision
```

## Confidence

`low | medium | high` — not a probability. Consider: quantity, quality,
recency and relevance of evidence; number of unknowns and assumptions;
consistency of signals; reversibility of the decision. Approximate
percentages may appear in prose but must not create false precision.
Scores and confidence levels exist to expose disagreement, not to
manufacture precision (adapted from Reforge —
https://www.reforge.com/blog/how-to-make-career-decisions).

## Expected Outcome

Encourage an explicit expectation before `accepted`:

```text
Expected:

Activation:
24% → 30–34%

Guardrail:
Trial-to-paid decline < 3pp

Review:
After 500 trials or 30 days.
```

Quantitative prediction is not mandatory when inappropriate; strategic
decisions may use verifiable qualitative criteria. Never invent a
baseline.

## Final Human Decision

Required separation:

```text
AI Recommendation:
Remove mandatory payment information.

Final Human Decision:
Run a 50/50 test for new self-service accounts.
```

## Structured output

Prefer structured output internally, then serialize to Markdown:

```json
{
  "recommendation": "...",
  "confidence": "medium",
  "bet_class": "offense",
  "facts": [],
  "evidence": [],
  "inferences": [],
  "assumptions": [],
  "unknowns": [],
  "options": [],
  "strongest_argument_against": "...",
  "expected_outcome": {},
  "revisit_condition": "..."
}
```

Validate → repair once → revalidate → fail explicitly. Never persist a
partially corrupted document.

## After persistence

```text
Created:
.product/decisions/DEC-XXXX-slug.md

Review:
git diff
```

Do not commit automatically.

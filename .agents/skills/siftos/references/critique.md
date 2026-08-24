# Critique — artifact critique (V0.4)

**Hero capability.** Evaluates the quality of the work artifact — not the
health of the SiftOS setup. Supersedes the DEC-0005 product-health/compliance
score design (see DEC-0006): scores tool usage rather than product work and
risks Goodhart/compliance behavior. `diagnose` + `audit` cover operational
health; critique covers the work.

## When to use

Any moment the user asks for a judgment on concrete work:

- an idea;
- a feature;
- a PRD or spec;
- a roadmap;
- a strategic proposal;
- an experiment;
- a decision record;
- an issue;
- a PR;
- a diff;
- an existing implementation;
- text provided in the conversation.

## Flow

```text
critique artifact
      ↓
top issues (≤ 3)
      ↓
user: "fix it"
      ↓
rewrite / patch / rescope the artifact
      ↓
re-critique
```

Critique is never analysis-only: the report ends with a concrete action
offer ("I can rewrite this spec around that test now.").

## Rubric

Directional score 0–100, weighted across six dimensions. The score is
**never a gate** and never a product KPI.

| Dimension | Weight | Question |
| --- | ---: | --- |
| Problem & User Value | 20 | Are we solving a real, important problem? |
| Strategy & Leverage | 20 | Does this move the current objective/constraint? |
| Evidence & Uncertainty | 15 | What supports the bet and what is still inference? |
| Solution & Scope | 15 | Is the solution proportional, focused, plausible? |
| Measurement & Learning | 15 | Will we know if it worked? Learn even on failure? |
| Cost & Reversibility | 15 | Right price to pay to reduce this uncertainty? |

The dimensions evaluate **the work**. They never evaluate whether a PDR
exists, whether METRICS.md is complete, or whether the user followed SiftOS.

## Verdicts

```text
BUILD NOW        strong on the dimensions that matter
TEST FIRST       cheap credible test before building
DEFER AS WRITTEN needs reshaping; the object is not ready
REJECT           no evidence of a real problem or leverage
```

## Output

```text
CRITIQUE — 61 / 100
Verdict: DEFER AS WRITTEN

Problem & User Value      82
Strategy & Leverage       76
Evidence & Uncertainty    35
Solution & Scope          64
Measurement & Learning    41
Cost & Reversibility      72

What survives
- The activation problem is real and aligned with the current objective.
- Removing one onboarding step is directionally plausible.

Top issues

1. The proposed solution outruns the evidence.
   We know activation is weak, but not that the credit-card step is
   the dominant cause.

2. There is no observable success threshold.
   "Improves activation" is not enough to judge the bet.

3. The implementation is larger than the uncertainty warrants.
   We can test the mechanism without rebuilding checkout.

Recommendation

TEST FIRST.

Cheapest credible test:
Remove the card requirement for 20% of new trials and compare
trial_started → activated against control.

What would change my verdict:
A meaningful activation lift without a material drop in qualified conversion.
```

Rules:

- At most 3 top issues. More than that is noise (same rule as diagnose).
- Every issue cites evidence from the artifact or product context; never
  invent baselines or outcomes.
- The report ends with action, not process.
- `Unknown.` is a finding; it degrades confidence, never the report's
  usefulness.

## Persistence

**No persistence by default.** A critique writes nothing. Only an explicit
request preserves the report (e.g. "please save this critique"); even that is
optional, never automatic. A preserved critique is a report the user asked
for, not a collector artifact.

## Distinctions

- `critique` = evaluation of the current work.
- `diagnose` = diagnosis of the overall product state (max 3 high-leverage
  issues, conversation, no score).
- `challenge` = adversarial review of a single decision record.
- `audit` = deterministic integrity check.

## Non-goals

- Critique does not gate anything (no Ship Gate coupling).
- Critique does not rank people or teams.
- Critique does not measure SiftOS usage or setup health.

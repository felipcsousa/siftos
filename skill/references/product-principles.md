# Product Principles

Principles SiftOS itself follows. The user controls their own
PRINCIPLES.md; SiftOS may suggest changes but never alters them
silently.

## 11.1 Evidence before confidence

Absence of evidence cannot be converted into narrative confidence. When
unknown: `Unknown.` is a valid answer.

## 11.2 Facts are not hypotheses

`Fact`, `Inference`, `Hypothesis`, `Recommendation` are never
semantically equivalent.

## 11.3 Human owns the decision

AI may analyze, recommend, contest, synthesize. The final decision
belongs to the human. Every PDR distinguishes `AI Recommendation` from
`Final Human Decision`.

## 11.4 Decisions need alternatives

Relevant decisions consider alternatives: `Option A`, `Option B`,
`Do nothing`. Rejected alternatives are recorded with the reason they
were rejected.

## 11.5 Predictions before outcomes

Expectations are recorded before results exist. Reduces hindsight bias.

## 11.6 Every decision can expire

A decision can be correct at T0 and incorrect at T1 because its context
changed.

## 11.7 Judgment over frameworks

RICE, ICE, MoSCoW and similar are auxiliary tools, never objective
mechanisms of truth.

## 11.8 Reversibility matters

Higher uncertainty, irreversibility or cost → higher scrutiny.

## 11.9 Local-first

The product stays readable without SiftOS installed. Canonical format:
Markdown. Historical persistence: Git.

## 11.10 Cross-harness by default

The same memory works in OpenCode and Codex without migration.

## 11.11 Scores expose disagreement, not precision

Scores, confidence levels and frameworks exist to make disagreement
visible and arguable — not to manufacture precision. A number never
replaces the argument behind it (adapted from Reforge —
https://www.reforge.com/blog/how-to-make-career-decisions).

## 11.12 The output of a decision is the next better-informed decision

The value of an experiment or decision is not the artifact it ships; it
is the improved decision it enables. If a decision produces no learning
that changes a future action, its information value was low (adapted
from Reforge — https://www.reforge.com/blog/good-experiment-bad-experiment).

## Anti-patterns SiftOS combats

- **Feature factory thinking** — output is not outcome.
- **Framework theater** — a score does not replace an argument.
- **AI certainty theater** — fluency is not evidence.
- **Retrospective rewriting** — predictions cannot be rewritten after
  outcome without history.
- **Fake metrics** — a metric without an operational definition is not
  useful.
- **Generic persona thinking** — "users" can be insufficient
  segmentation.
- **Solution lock-in** — an observed problem does not validate a
  solution.
- **Roadmap inertia** — context changes.
- **Evidence laundering** — an opinion cited repeatedly does not become
  a fact.
- **Consensus theater** — absence of dissent may mean absence of
  challenge.

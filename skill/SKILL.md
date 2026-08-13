---
name: siftos
description: >-
  SiftOS — Product Decision Intelligence. Persistent product context plus a
  structured decision protocol (decide, challenge, record, review, learn) for
  AI-native teams. Use when the user wants to initialize product context,
  analyze or record a product decision, challenge an idea or existing
  decision, register an outcome, search decision history, or audit decision
  health. Product memory lives in .product/ (Markdown + Git). Human owns the
  decision.
version: 0.1.0
---

# SiftOS

Product memory belongs to the repository, not to the AI vendor.

SiftOS gives agents persistent product context and a structured decision
protocol. The core loop:

```text
Decision → Prediction → Outcome → Learning
```

## Memory layout

```text
.product/
├── PRODUCT.md        durable product context
├── STRATEGY.md       current strategic objective and bets
├── METRICS.md        metrics, baselines, targets (baseline: unknown is valid)
├── PRINCIPLES.md     persistent organizational opinions
├── decisions/        Product Decision Records (DEC-XXXX-slug.md)
├── evidence/         supporting material
└── config.json
```

The skill definition lives in `.agents/skills/siftos/`. Never mix skill
code and product memory.

## Workflows

Six workflows with identical semantics in every harness (OpenCode, Codex):

| Workflow   | What it does |
| ---------- | ------------ |
| `init`     | Build persistent product context (5–10 min target, progressive). |
| `decide`   | Structure a decision: facts, evidence, assumptions, unknowns, alternatives, recommendation, dissent, expected outcome, revisit condition. |
| `challenge`| Adversarial review of an idea or an existing PDR. Never modifies the PDR. |
| `review`   | Close the loop: compare prediction with outcome, extract learnings. |
| `show`     | Retrieve decisions by ID, text, tags, status, owner, goal, pending review. |
| `audit`    | Decision Health: counts, waiting reviews, deterministic linter findings. |

### Invocation

The user may invoke a workflow explicitly (`siftos init`, `/product decide
...`, "run the audit") or by intent ("should we remove the credit card
requirement from trial?" → `decide`). Resolve intent to a workflow, then
load the matching reference:

- `decide` → `references/decision-protocol.md` + `references/decision-schema.md` + `references/evidence-rules.md`
- `challenge` → `references/challenge-rules.md`
- `review` → `references/review-protocol.md` + `references/decision-schema.md`
- `audit` → `references/linter-rules.md` (run `scripts/audit.mjs`)
- `init` → `references/decision-schema.md` (directory structure only) + `assets/` templates
- `show` → `scripts/search.mjs` / `scripts/status.mjs`, then read files

## Non-negotiable rules

1. **Human owns the decision.** AI analyzes, recommends, contests. The
   final decision belongs to the human. `Final Human Decision` and `AI
   Recommendation` are always separate. A PDR may reach `accepted` only
   after an explicit human decision (`no-human-decision` is ERROR).
2. **Unknown is a valid answer.** Never fill gaps by inventing data.
   Missing baseline, missing source, missing owner → `unknown` /
   `Source: unspecified`. Never fabricate evidence.
3. **Facts are not hypotheses.** Keep `Facts`, `Evidence`, `Inferences`,
   `Assumptions`, `Unknowns` in their own sections. Never file an
   assumption under Facts.
4. **Predictions before outcomes.** `Expected Outcome` is recorded before
   the outcome exists. During `review` the original prediction is
   preserved verbatim — never rewrite history to match results.
5. **Write only inside `.product/`** (and the skill installation itself).
   Anything else requires explicit user permission. Never run `git commit`
   automatically; present `git diff` for the user to review.
6. **Deterministic operations go through scripts** (IDs, validation,
   audit, search). Do not guess decision IDs — run
   `scripts/next-decision-id.mjs`. Never reuse a removed ID.
7. **Alternatives and dissent.** Relevant decisions include alternatives
   (`do nothing` when applicable), rejected alternatives with their
   reasons, and a real `Strongest Argument Against`. Dissent must be able
   to change the decision — not performative.
8. **Judgment over frameworks.** RICE/ICE/MoSCoW are auxiliary, never
   objective truth. Scores never replace argument.
9. **Evidence provenance.** Evidence records
   `Claim | Source | Date`. External claims add `Source URL` and
   `Access: public|gated` — never cite gated content. `Source:
   unspecified` is valid; inventing a source is prohibited.
10. **ID permanence.** `DEC-XXXX` never changes. Status lifecycle:
    `draft → proposed → accepted → shipped → reviewed`, plus
    `proposed → rejected`, `accepted → cancelled | superseded`,
    `shipped → superseded`.

## Schema failure protocol

Structured workflow output is validated before persistence. If invalid:
repair once, revalidate, and on failure fail explicitly — never persist a
partially corrupted document. See `references/decision-schema.md`.

## Git

SiftOS never commits. After creating or updating a PDR:

```text
Created:
.product/decisions/DEC-0042-remove-credit-card.md

Review:
git diff
```

## Scope

SiftOS is not a backlog, roadmap, analytics, or project management tool.
It manages the reasoning that creates product artifacts. If an action does
not improve the user's ability to take, record, or learn from a decision,
it does not belong here.

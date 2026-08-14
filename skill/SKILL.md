---
name: siftos
description: >-
  SiftOS — Product Decision Intelligence. Persistent product context plus a
  structured decision protocol (decide, shape, validate, challenge, record,
  review, ship, learn) and optional user-configurable lifecycle hooks for AI
  coding agents. Use for product decisions, bets, validation, challenge,
  prioritization, diagnosis, Ship Gate, outcomes, decision history, audits,
  or hook configuration. Product memory lives in .product/ (Markdown + Git).
  Human owns the decision; automation is always user-chosen.
version: 0.1.0
---

# SiftOS

Product memory belongs to the repository, not to the AI vendor.

Core loop:

```text
Decision → Prediction → Outcome → Learning
```

Automatic hooks are an optional orchestration layer. With every hook off,
all explicit workflows still work. Installing or initializing SiftOS never
enables hooks by itself.

## Memory layout

```text
.product/
├── PRODUCT.md
├── STRATEGY.md
├── METRICS.md
├── PRINCIPLES.md
├── ROADMAP.md
├── config.json
├── decisions/
├── evidence/
├── .runtime/        disposable, gitignored
└── .index/          derived, gitignored
```

The skill lives in `.agents/skills/siftos/`. Never mix skill code and product
memory.

## Workflows

Product memory and explicit workflow semantics are portable across OpenCode
and Codex. Automatic lifecycle interception is harness-specific; do not claim
hook parity where the platform does not expose an equivalent lifecycle point.

| Workflow | What it does |
| --- | --- |
| `init` | Build persistent product context progressively. |
| `decide` | Structure facts, evidence, assumptions, alternatives, recommendation, dissent and prediction. |
| `shape` | Turn an idea into a Bet: problem, target user, hypothesis, SVT, scope, non-goals and measurement. |
| `validate` | Define a Validation Contract before results exist. |
| `challenge` | Adversarial review without modifying the PDR. |
| `prioritize` | Compare Bets using strategy, constraint, evidence, cost, reversibility and learning value. |
| `diagnose` | Find the highest-leverage product health issues. |
| `ship` | Run the deterministic Ship Gate on an accepted+ Bet. |
| `review` | Compare prediction with outcome and extract learning. |
| `show` | Retrieve decision history. |
| `audit` | Decision Health + deterministic linter findings. |
| `hooks` | Inspect/change lifecycle automation. |

### Invocation

Resolve user intent to a workflow and load only the relevant references:

- `decide` → `references/decision-protocol.md` + `references/decision-schema.md` + `references/evidence-rules.md`
- `shape` → `references/shape.md` + `references/decision-schema.md`
- `validate` → `references/validate.md`
- `challenge` → `references/challenge-rules.md`
- `prioritize` → `references/prioritize.md`
- `diagnose` → `references/diagnose.md`
- `ship` → `references/ship.md`
- `review` → `references/review-protocol.md` + `references/decision-schema.md`
- `audit` → `references/linter-rules.md`
- `show` → deterministic search/status scripts
- `hooks` → `references/hooks.md`

## Automatic hooks

Before assuming automation exists, read the effective policy with
`siftos hooks` (or `scripts/hooks.mjs`). The three states are distinct:

```text
Installed ≠ Enabled ≠ Observed
```

**Disabled means disabled.** Never run product enforcement the user turned
off.

Product Guard levels:

```text
L0 technical
L1 minor
L2 material
L3 strategic/high-impact
```

In `advisory`, automatic hooks never block. In `balanced`, unresolved L2/L3
production mutation remains gated until an authorizing resolution exists. In
`strict`, L2/L3 and unknown material mutations may require resolution.

### Critical Guard invariant

`block_issued` is only a UX flag. It is **never authorization**.

Retrying a blocked mutation must remain blocked. Production mutation may
proceed only when the current product intent has one of these authorizations:

- `prototype` — exploratory implementation, not production commitment;
- `existing_bet` — attach to a real accepted+ PDR/Bet;
- `build_anyway` — explicit human bypass.

`shape`, `validate` and `reconsider` are valid next steps, but they do not
silently authorize production code. SiftOS-internal writes in `.product/` may
proceed while production mutation remains gated.

### Harness capabilities

**Codex:** repository hooks implement SessionStart context, UserPromptSubmit
intent state, PreToolUse mutation gating, PostToolUse footprint, PreCompact
state preservation, Stop closeout/one continuation, and SessionEnd cleanup.
Use native hook JSON contracts; do not emulate blocking with prose/exit codes.

**OpenCode:** the repository plugin implements native before/after tool hooks,
session lifecycle observation, compaction context, and advisory closeout at
idle. OpenCode currently has no documented 1:1 contract for Codex-style
UserPromptSubmit context injection or Stop continuation. Do not pretend those
capabilities exist; surface degraded behavior when relevant.

Hooks never make canonical product memory disposable. `.product/.runtime/`
contains only reconstructable session state.

## Non-negotiable rules

1. **Human owns the decision.** Separate `AI Recommendation` from `Final Human Decision`. Never accept a decision without explicit human choice.
2. **Unknown is valid.** Never invent evidence, baselines, owners or sources.
3. **Facts are not hypotheses.** Keep Facts, Evidence, Inferences, Assumptions and Unknowns semantically separate.
4. **Predictions before outcomes.** Never rewrite an original prediction during review.
5. **Write boundary.** SiftOS writes canonical product state only inside `.product/` and its own installation. Never commit automatically.
6. **Deterministic operations use scripts/core.** IDs, validation, audit, search, Ship Gate and hook policy are not guessed by the model.
7. **Alternatives and dissent are real.** Include alternatives and a strongest argument against that could actually change the choice.
8. **Judgment over frameworks.** RICE/ICE/MoSCoW never become objective truth.
9. **Evidence provenance.** Record Claim | Source | Date; never invent a source.
10. **ID permanence.** `DEC-XXXX` is never reused.
11. **Automation is explicit.** Installing ≠ enabling. User may disable every hook and manual SiftOS remains first-class.
12. **Ship Gate is not deployment authorization.** Product readiness and security permissions are separate systems.
13. **Capability claims must be executable.** If a harness adapter cannot perform a lifecycle behavior, report it as degraded instead of calling it supported.

## Schema failure protocol

Validate structured workflow output before persistence. Repair once; if still
invalid, fail explicitly. Never persist partially corrupted product memory.

## Git

After creating/updating a PDR, show the path and ask the user to review the
diff. Never `git commit` automatically.

## Scope

SiftOS is not a backlog, analytics or project-management replacement. If an
action does not improve the ability to make, preserve, contest, measure or
learn from a product decision, it does not belong here.

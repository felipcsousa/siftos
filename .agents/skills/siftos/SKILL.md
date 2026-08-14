---
name: siftos
description: >-
  SiftOS — Product Decision Intelligence. Persistent product context plus a
  structured decision protocol (decide, shape, validate, challenge, record,
  review, ship, learn) and a user-configurable automatic hook layer for AI
  coding agents. Use when the user wants to initialize product context,
  shape or validate a bet, analyze or record a product decision, challenge
  an idea or existing decision, run the Ship Gate, register an outcome,
  search decision history, audit decision health, or change how proactive
  SiftOS is (hooks). Product memory lives in .product/ (Markdown + Git).
  Human owns the decision; automation is always user-chosen.
version: 0.1.0
---

# SiftOS

Product memory belongs to the repository, not to the AI vendor.

SiftOS gives agents persistent product context and a structured decision
protocol. The core loop:

```text
Decision → Prediction → Outcome → Learning
```

V2 adds an optional, user-configurable hook layer around the coding
lifecycle. Hooks are enhancement, never a dependency: with every hook off,
the explicit workflows below keep working.

## Memory layout

```text
.product/
├── PRODUCT.md        durable product context
├── STRATEGY.md       current strategic objective and bets
├── METRICS.md        metrics, baselines, targets (baseline: unknown is valid)
├── PRINCIPLES.md     persistent organizational opinions
├── ROADMAP.md        NOW / NEXT / LATER / NOT NOW (derived, regenerable)
├── config.json       repository config incl. hook policy (PRD V2 §13)
├── decisions/        Product Decision Records (DEC-XXXX-slug.md)
├── evidence/         supporting material
├── .runtime/         disposable session state (gitignored, PRD V2 §83)
└── .index/           derived indexes (gitignored, regenerable)
```

The skill definition lives in `.agents/skills/siftos/`. Never mix skill
code and product memory.

## Workflows

All workflows share identical semantics in every harness (OpenCode, Codex).
A "bet" is a record in the pre-acceptance stretch of the same lifecycle —
Bet → Decision → Build → Outcome → Learning is status transitions, not
artifact types.

| Workflow    | What it does |
| ----------- | ------------ |
| `init`      | Build persistent product context (5–10 min target, progressive). |
| `decide`    | Structure a decision: facts, evidence, assumptions, unknowns, alternatives, recommendation, dissent, expected outcome, revisit condition. |
| `shape`     | Transform an idea into a bet: problem, target user, evidence, hypothesis, SVT, scope, non-goals, measurement. |
| `validate`  | Create a Validation Contract (critical assumption, test, pass/fail thresholds) before results exist. |
| `challenge` | Adversarial review of an idea or an existing PDR. Never modifies the PDR. |
| `prioritize`| Rank bets using strategic fit, constraint, upside, evidence, cost, reversibility, learning value. |
| `diagnose`  | Novice-friendly health check: ICP, strategy, goal, constraint, metrics, evidence, bets, roadmap, review discipline. |
| `ship`      | Run the deterministic Ship Gate (`siftos ship <DEC-XXXX>`) on an accepted+ bet. |
| `review`    | Close the loop: compare prediction with outcome, extract learnings. |
| `show`      | Retrieve decisions by ID, text, tags, status, owner, goal, pending review. |
| `audit`     | Decision Health: counts, waiting reviews, deterministic linter findings. |
| `hooks`     | Show or change the automatic hook policy (presets, per-hook toggles, session overrides). |

### Invocation

The user may invoke a workflow explicitly (`siftos init`, `/siftos decide
...`, "run the audit") or by intent ("should we remove the credit card
requirement from trial?" → `decide`). Resolve intent to a workflow, then
load the matching reference:

- `decide` → `references/decision-protocol.md` + `references/decision-schema.md` + `references/evidence-rules.md`
- `shape` → `references/shape.md` + `references/decision-schema.md`
- `validate` → `references/validate.md`
- `challenge` → `references/challenge-rules.md`
- `prioritize` → `references/prioritize.md`
- `diagnose` → `references/diagnose.md`
- `ship` → `references/ship.md` (run `siftos ship <DEC-XXXX>`; automatic and manual share the same logic)
- `review` → `references/review-protocol.md` + `references/decision-schema.md`
- `audit` → `references/linter-rules.md` (run `scripts/audit.mjs`)
- `init` → `references/decision-schema.md` (directory structure only) + `assets/` templates
- `show` → `scripts/search.mjs` / `scripts/status.mjs`, then read files
- `hooks` → `references/hooks.md` (run `siftos hooks` where available)

## Automatic hooks

When hooks are enabled (repository config, PRD V2), the agent executes the
configured behavior at lifecycle moments — session start, prompt submit,
before mutation, after mutation, turn stop, compaction, subagent start,
session end. Rules:

- Read the **effective** policy with `siftos hooks` (or `node
  .agents/skills/siftos/scripts/hooks.mjs`) before acting on it. Session
  overrides in `.product/.runtime/` win over repository config.
- **Disabled means disabled** (PRD V2 §164): never run a hook the user
  turned off, no matter how relevant it looks.
- The Product Guard classifies work L0 (technical) / L1 (minor) / L2
  (material) / L3 (strategic). The gate is deterministic: `balanced`
  blocks L2/L3 once until resolved; `advisory` never blocks; `strict`
  hard-gates. `Build anyway` (or `prototype`, `existing bet`, `shape`,
  `validate`, `reconsider`) is always available to the user — the human
  owns the decision (PRD V2 §53).
- Hooks never modify canonical product memory. Runtime state lives in
  `.product/.runtime/` and is disposable.
- Agent-executed hooks use the model for judgment (guard level, advice);
  script-executed hooks (Codex hook.mjs) use the deterministic fallback.
  The gate itself never depends on the model.

See `references/hooks.md` for the full hook playbook.

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
   audit, search, ship gate, hooks status). Do not guess decision IDs —
   run `scripts/next-decision-id.mjs` (locked, PRD §26). Never reuse a
   removed ID.
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
10. **ID permanence.** `DEC-XXXX` never changes. Unified lifecycle:
    `draft → shaping → validating → ready → accepted → building →
    shipped → measuring → reviewed`, with `proposed` kept as the v0.2
    pre-acceptance status, plus `rejected`, `cancelled`, `paused`,
    `failed`, `superseded` (see `src/status.ts`).
11. **Automation is never mandatory and never invisible.** Every hook can
    be off; manual workflows always work. When hooks are on, the agent
    surfaces what it did (guard, advice, closeout) and the user can bypass
    at any time. Installed ≠ enabled ≠ active.
12. **Ship Gate is product lifecycle state, not deployment authorization.**
    `siftos ship` verifies measurement readiness. It does not deploy and
    never replaces security/permission mechanisms.

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

SiftOS is not a backlog, analytics, or project management tool. ROADMAP.md
is derived from active bets; hooks observe and advise but never replace
the user's judgment. If an action does not improve the user's ability to
take, record, or learn from a decision, it does not belong here.

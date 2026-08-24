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
version: 0.3.0
---

# SiftOS

Product memory belongs to the repository, not to the AI vendor.

The user's goal is the work. SiftOS is decision support, not a gate.
Default: help make and execute product decisions in the conversation —
options, evidence, cheapest test, cost of error, verdict. Full PDR records
are an explicit opt-in, proposed only when a decision is irreversible,
expensive, or transversal, and always with the ceremony cost stated.

## Default: prioritize

When the user asks "what should we build" / "what's next" / "should we do X" —
this is the default. Plain language, no ceremony, no records.

Weigh candidates against strategy, constraint, evidence, cost, reversibility
and learning value. Produce a ranked list:

```text
BUILD NOW     <bet> — <reasoning>
DEFER         <bet> — <trigger>
REJECT        <bet> — <reason>
```

5–10 minutes. If the user picks BUILD NOW, log it in
`.product/evidence/candidates.md` if worth remembering. Escalate to a full
`decide` PDR only if irreversible/expensive/transversal — and state the
ceremony cost (~30–60 min) first.

## When to record

Full PDR records (`decide`/`shape`) are an explicit opt-in, proposed only when
a decision is irreversible, expensive, or transversal. State the ceremony cost
(~30–60 min) and get explicit user consent before proceeding.

Other workflows (`validate`, `challenge`, `diagnose`, `ship`, `review`) are
available on demand but never triggered automatically unless the user asks.

## Workflows

Product memory and explicit workflow semantics are portable across OpenCode,
Codex and DeepSeek Harness (dsh). Automatic lifecycle interception is
harness-specific; do not claim hook parity where the platform does not expose
an equivalent lifecycle point.

| Workflow | When | Cost |
|---|---|---|
| `prioritize` | Default for "what to build" | 5–10 min, no records |
| `decide` | Irreversible/expensive/transversal | ~30–60 min, full PDR |
| `shape` | Idea → Bet with hypothesis | ~30–60 min, full PDR |
| `validate` | Before results exist | ~15 min, contract record |
| `challenge` | Adversarial review | ~10 min, no modification |
| `diagnose` | Find highest-leverage issues | ~5 min, conversation |
| `ship` | Ship Gate on accepted+ Bet | ~5 min, deterministic check |
| `review` | Compare prediction vs outcome | ~15 min, record update |
| `show` | Retrieve decision history | ~1 min, read-only |
| `audit` | Decision health + linter | ~5 min, deterministic |
| `init` | Build product context | progressive |
| `hooks` | Inspect/change automation | reference |

### Reference loading

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

## Hooks (optional)

Before assuming automation exists, read the effective policy with
`siftos hooks` (or `scripts/hooks.mjs`). The three states are distinct:

```text
Installed ≠ Enabled ≠ Observed
```

**Disabled means disabled.** Never run product enforcement the user turned
off. Installing or initializing SiftOS never enables hooks by itself.

Product Guard levels: L0 technical, L1 minor, L2 material, L3 strategic.
In `advisory`, hooks never block. In `balanced`, unresolved L2/L3 production
mutation gates until authorizing resolution. In `strict`, L2/L3 and unknown
material mutations may require resolution.

**Critical Guard invariant:** `block_issued` is a UX flag, never authorization.
Production mutation proceeds only with: `prototype`, `existing_bet`, or
`build_anyway` (explicit human bypass).

### Harness capabilities

**Codex:** SessionStart context, UserPromptSubmit intent, PreToolUse gating,
PostToolUse footprint, PreCompact state, Stop closeout, SessionEnd cleanup.

**OpenCode:** native before/after tool hooks, lifecycle observation, compaction
context, advisory closeout at idle. No documented 1:1 contract for
Codex-style context injection or Stop continuation.

**DeepSeek Harness (dsh):** session-start capsule, pre-step intent intake,
pre-execute mutation gating, result footprint, turn-stopping closeout with one
`agent.steer` continuation, disposed cleanup. Developer-preview APIs.

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

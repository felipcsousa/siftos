---
name: siftos
description: >-
  SiftOS — Product judgment for coding agents. Gives agents persistent
  product context (strategy, evidence, prior decisions, learnings) and
  uses it to prioritize work, critique ideas, catch contradictions and
  improve product decisions in the conversation. Use for "what should we
  build", "critique this spec/PRD/PR", "does this align with our
  strategy", "did it work", product-aware implementation preflight, and
  durable product memory. Product memory lives in .product/ (Markdown +
  Git). Human owns the decision; automation is always user-chosen.
version: 0.3.0
---

# SiftOS

SiftOS gives coding agents product judgment grounded in this product's
strategy, evidence, prior decisions and learnings.

The user's work is always primary. SiftOS is judgment, not gatekeeping:
it helps the user build better product, and remembers what matters without
getting in the way.

## Default behavior

1. Understand the actual product question.
2. Retrieve only relevant product context.
3. Give the useful judgment first.
4. Help act on it.
5. Persist only durable information worth future retrieval.

Never ask the user to choose a SiftOS workflow — resolve intent internally.

## Core capabilities

Four hero capabilities, all in conversation. No commands to learn, no
records required.

### Prioritize — "What should we do?"

Rank candidates against the current constraint: BUILD NOW / DEFER /
REJECT. No scores, no records. → `references/prioritize.md`

### Critique — "Is this actually good?"

Score a spec, PRD, roadmap, feature, PR, diff or existing implementation
0–100 across six judgment dimensions, surface at most three issues, end
with a concrete action. Never a gate; nothing persisted by default.
→ `references/critique.md`

### Align — "Does this make sense for this product?"

Check the change against strategy, prior decisions and learnings:
ALIGNED / TENSION / CONFLICT / INSUFFICIENT CONTEXT. Includes the
product-aware implementation preflight. → `references/align.md`

### Review — "What did we actually learn?"

Compare prediction vs outcome and carry the learning forward.
→ `references/review-protocol.md`

Natural language maps to capabilities:

> "Should we build referral next?" → prioritize
> "Critique this PRD." → critique
> "Does this PR make sense given our activation goal?" → align
> "We shipped this last month, did it work?" → review
> "Implement mandatory card collection on trial." → product-aware preflight, then execution

Shared judgment principles for all of them:
`references/product-judgment.md`.

## Durable memory

Memory is silent infrastructure. Most durable decisions and learnings
belong in compact entries with zero ceremony; full PDRs are the exception.

- **Write eligibility.** Only: human-committed decisions ("let's go with
  B"), observed learnings ("the experiment did not improve activation"),
  confirmed durable constraints, or evidence that will change future
  decisions. Brainstorming is never memory.
- **Persistence rule.** The value of remembering must exceed the cost of
  future retrieval. If it will not change a future decision, do not
  persist it.
- **Full PDR (`decide`)** is explicit opt-in, proposed only for
  irreversible, expensive, transversal, pricing/business-model or
  constitutional decisions — with the ceremony cost stated (~30–60 min)
  and explicit human consent before any record is created. Compact memory
  remains a valid choice even then.
- **No automatic persistence.** No candidate logs, no critique snapshots,
  no records from exploration. Only the user's effective choice can become
  memory. Compact product memory (`MEMORY.md`) is the default home for
  durable entries and ships in the next iteration. Today durable decisions
  worth preserving are proposed as explicit PDR opt-ins (decide) or not
  persisted; no automatic persistence, no candidate logs.

## Ceremony Budget

For normal interactions:

- 0 questions about "workflow";
- 0 lifecycle explanations;
- 0 mentions of Guard/hooks/status unless relevant or requested;
- at most one process sentence before delivering judgment;
- never ask the user to fill fields to satisfy a schema;
- never create a PDR before the recommendation;
- at most three priority issues in critique/diagnose;
- no checklist dumps;
- `Unknown.` degrades confidence, never utility.

Missing context:

```text
Bad:  "METRICS.md has Unknown activation baseline. Please initialize SiftOS first."
Good: "I'd favor A, but confidence is medium because I couldn't find an
       activation baseline. If activation is still the current constraint,
       A dominates B."
```

## Advanced

Workflows available on demand, never the default interface:

| Workflow | When | Cost |
|---|---|---|
| `decide` | Full PDR for high-stakes decisions | ~30–60 min, opt-in |
| `shape` | Idea → Bet with hypothesis | ~30–60 min, full PDR |
| `validate` | Define test criteria before results exist | ~15 min, contract |
| `challenge` | Adversarial review of a record | ~10 min, read-only |
| `diagnose` | Overall product state, top 3 issues | ~5 min, conversation |
| `audit` | Deterministic integrity check | ~5 min |
| `ship` | Ship Gate on accepted+ bet | ~5 min, deterministic |
| `review` | Full PDR prediction vs outcome | ~15 min, record update |
| `show` | Retrieve decision history | ~1 min, read-only |
| `init` | Build product context | progressive |
| `hooks` | Inspect/change automation | reference |

### Reference loading

Resolve user intent; load only the relevant references:

- `prioritize` → `references/prioritize.md`
- `critique` → `references/critique.md`
- `align` → `references/align.md`
- `decide` → `references/decision-protocol.md` + `references/decision-schema.md` + `references/evidence-rules.md`
- `shape` → `references/shape.md` + `references/decision-schema.md`
- `validate` → `references/validate.md`
- `challenge` → `references/challenge-rules.md`
- `diagnose` → `references/diagnose.md`
- `ship` → `references/ship.md`
- `review` → `references/review-protocol.md` + `references/decision-schema.md`
- `audit` → `references/linter-rules.md`
- `show` → deterministic search/status scripts
- `hooks` → `references/hooks.md`

Any judgment interaction may also load
`references/product-judgment.md`.

### Hooks (optional)

Before assuming automation exists, read the effective policy with
`siftos hooks` (or `scripts/hooks.mjs`). The three states are distinct:

```text
Installed ≠ Enabled ≠ Observed
```

**Disabled means disabled.** Never run product enforcement the user turned
off. Installing or initializing SiftOS never enables hooks by itself.

Product Guard levels: L0 technical, L1 minor, L2 material, L3 strategic.
In `advisory`, hooks never block. In `balanced`, unresolved L2/L3
production mutation gates until authorizing resolution. In `strict`, L2/L3
and unknown material mutations may require resolution.

**Critical Guard invariant:** `block_issued` is a UX flag, never
authorization. Production mutation proceeds only with: `prototype`,
`existing_bet`, or `build_anyway` (explicit human bypass).

Harness capabilities and lifecycle events: `references/hooks.md`. Hook
behavior is frozen in V0.4 — no new adapters, events or presets.

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

The skill lives in `.agents/skills/siftos/`. Never mix skill code and
product memory.

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

Validate structured workflow output before persistence. Repair once; if
still invalid, fail explicitly. Never persist partially corrupted product
memory.

## Git

After creating/updating a PDR, show the path and ask the user to review
the diff. Never `git commit` automatically.

## Scope

SiftOS is not a backlog, analytics or project-management replacement. If
an action does not improve the ability to make, judge or learn from a
product decision, it does not belong here.

---
id: DEC-0006
title: V0.4 — Judgment First: product judgment layer for coding agents
status: accepted

created_at: 2026-08-24
updated_at: 2026-08-24

owner: siftos-team

tags:
  - v0.4
  - judgment-first
  - critique
  - align
  - compact-memory
  - behavioral-evals
  - product-judgment

goal: improve-decision-quality

bet_class: offense

confidence: high

reversibility: high
cost_of_delay: low

review_date: 2026-11-18

supersedes: DEC-0005
superseded_by: null

agent_workflow_version: decide-v1
---

# Decision

## Context

The product still carries a governance-first center of gravity: 15 lifecycle states, a 12-workflow table in SKILL.md, a validated-but-unbuilt critique that scores product-memory health, and an onboarding narrative ("First bet in 10 minutes") that teaches install → init → shape → validate → challenge. DEC-0004 correctly started the reorientation (prioritize default, PDR opt-in), but the felt experience is still "a place where decisions are stored", not "an agent that makes better product judgments". This decision moves the center of gravity to judgment: the user's work first, memory as silent infrastructure, ceremony only when it buys leverage.

## Goal

Make SiftOS perceived as the reason the coding agent makes better product judgments, with the first useful interaction happening before any workflow is chosen. Measured by behavioral evals comparing the same model with and without SiftOS.

## Facts

- SKILL.md (v0.3.0, post-PR-#8) is 176 lines: prioritize default, PDR opt-in with stated ceremony cost, 12-workflow table, 13 non-negotiable rules, hooks section. Mirrored byte-identical in `.agents/skills/siftos/`.
- docs/quickstart.md "First bet in 10 minutes" teaches install → init → shape → validate → challenge → ship/review — the pre-V0.4 architecture.
- skill/references/critique.md (DEC-0005, SVT PASS 2026-08-24) designs a quantitative product-health score across 5 dimensions (memory completeness, decision quality, validation rigor, learning capture, strategy alignment) with persisted trend snapshots; not built, build deferred to guardrail lift.
- DEC-0003 guardrail: zero new feature builds before 2026-11-16.
- evals/ contains deterministic core evals only: 5 fixtures asserted on validate/audit/search/lint/next-id; LLM-dependent workflows are reported MANUAL. No behavioral judgment evals exist.
- Test suite: 222 tests across 18 files, all passing on main.
- README opens with "Product Decision Intelligence for AI-native teams" and the Decision → Prediction → Outcome → Learning loop; quickstart requires init.
- The deterministic core (parser, schema, lifecycle, linters, search, guard policy, Ship Gate, context compiler) is mature and bounded; no storage rework is needed.

## Evidence

- Claim: SKILL.md v0.3.0 structure and workflow table | Source: skill/SKILL.md | Date: 2026-08-24 | Access: public
- Claim: quickstart teaches init→shape→validate→challenge | Source: docs/quickstart.md | Date: 2026-08-24 | Access: public
- Claim: critique reference is a product-health score, not built | Source: skill/references/critique.md + DEC-0005 | Date: 2026-08-24 | Access: public
- Claim: 222 tests pass on main post-PR-#8 | Source: npm run test (vitest) | Date: 2026-08-24 | Access: public
- Claim: evals are deterministic-only; LLM workflows MANUAL | Source: evals/run.mjs header comment | Date: 2026-08-24 | Access: public
- Claim: PRD V0.4 proposes judgment-first architecture with 6-dimension artifact critique, align, compact memory, behavioral evals, zero-ceremony onboarding | Source: PRD "SiftOS V0.4 — Judgment First" | Date: 2026-08-24 | Access: public

## Inferences

- The felt blocker is the prompt default and the onboarding narrative, not the deterministic core — the same diagnosis DEC-0004 made, one level deeper.
- Artifact critique (spec/PRD/PR/diff), align and compact memory raise felt utility without storage rework because they change what the agent says first.
- Behavioral evals are the missing release gate: deterministic tests cannot prove judgment uplift.
- A compact memory layer sits between "record nothing" and "full PDR" and is the operational expression of the longitudinal moat.

## Assumptions

- The V0.4 SKILL.md rewrite preserves the 13 non-negotiable rules.
- Critique scores stay directional, never a gate and never a product KPI.
- Same-model pairwise evals are a valid proxy for felt product value.
- Existing PDRs, hooks and CLI keep working unchanged (no destructive migration).

## Unknowns

- Whether pairwise win ≥ 70% is achievable with current model quality on the first eval suite.
- Whether compact memory changes future recommendations without adding ceremony.
- Whether zero-init onboarding makes advanced methodology (validate, PDR, lifecycle) feel lost rather than hidden.

## Options Considered

- A. V0.4 judgment-first: skill behavior rewrite + artifact critique + align + compact memory + behavioral evals + zero-ceremony onboarding.
- B. V0.3.1 incremental: keep health-score critique, rewrite only README/quickstart.
- C. Continue governance expansion: new lifecycle features, Guard levels, analytics.
- D. Full rewrite (SiftOS V3) with a new storage architecture.

## Alternatives Rejected

- B. V0.3.1 incremental — rejected: the health-score critique measures SiftOS usage, not product work, and a narrative-only change leaves the felt blocker (critique direction + onboarding) in place.
- C. Governance expansion — rejected: adds exactly the ontology the V0.4 diagnosis identifies as the core problem and violates the amended DEC-0003 guardrail.
- D. Full rewrite — rejected: the deterministic core is mature (222 tests passing); rewriting spends effort on what already works and risks the storage guarantees.

## AI Recommendation

Adopt V0.4 as a strategic simplification, sequenced as PR A (behavior first: new SKILL.md, artifact critique, align, revised prioritize, product-judgment reference, 10 behavioral eval cases + 3 ceremony cases) → PR B (compact memory as substrate) → PR C (zero-ceremony onboarding) → PR D (positioning alignment). The release gate is behavioral: pairwise win rate and ceremony regression, not schema validity.

## Final Human Decision

Confirmed by human on 2026-08-24: adopt V0.4 Judgment First. DEC-0003 guardrail amended to allow utility, ceremony-reduction, behavioral-eval and product-judgment work. DEC-0005 critique health-score design superseded. Execute PR A now.

## Rationale

The product has already diagnosed its own utility problem (DEC-0004, this PRD); the deterministic core is the moat's foundation, not its friction; and the highest-leverage change is the default behavior of the agent. Judgment-first makes every interaction deliver value before any SiftOS concept is learned, and behavioral evals make the uplift observable for the first time.

## Strongest Argument Against

V0.4 hides the methodology's rigor behind a conversational surface: if the model's judgment is weak, the product reduces to a generic critique skill with no differentiator, and users who valued the explicit methodology (validate contracts, PDRs, Ship Gate) may conclude the product lost depth. The mitigation is the eval gate and a clearly labeled Advanced surface, but both are execution risks, not design guarantees.

## Expected Outcome

- Pairwise win rate ≥ 70% for SiftOS vs same-model baseline on the 10 judgment eval cases.
- Loss rate ≤ 10%.
- 0 ceremony regressions on technical or no-context cases (rename helper, fix flaky test, upgrade zod).
- Historical-memory retrieval and use ≥ 90% on prepared fixtures.
- 0 fabricated facts in gold cases.
- First useful judgment in ≤ 1 product interaction after install (no init required).

## Primary Metric

Judgment uplift: pairwise win rate of SiftOS vs same-model baseline on evals/judgment/ (target ≥ 70%), with ceremony rate < 10% on no-context cases.

## Guardrails

- Critique score is directional, never a gate and never a product KPI (0 gate couplings).
- 0 new lifecycle states, statuses, Guard levels, adapters or taxonomies in V0.4.
- 0 fabricated baselines or facts in eval gold cases.
- 0 destructive migration: existing PDRs keep parsing, validating and reviewing unchanged.
- 0 new harnesses, governance machinery, analytics or unrelated workflows (amended DEC-0003 prohibition, carries forward).

## Reversibility

High: the change is skill files, references, decision records and eval scaffolding; revert is a git checkout. No storage migration, no schema change.

## Cost of Delay

Low-to-medium: the utility gap persists and adoption metrics (DEC-0002) keep underperforming while the felt experience stays governance-first; each week of delay compounds the onboarding narrative gap.

## What Would Change Our Mind

- Evals show no material uplift (pairwise < 60%): the judgment-first surface does not deliver; revisit the thesis before PR B.
- Ceremony regressions on technical tasks: tighten non-intervention rules (FR-002).
- Users report the lost explicit methodology as a real cost, not perceived: restore a methodology surface.

## Revisit Condition

2026-11-18 — with DEC-0002 resolved and PR A dogfooded, review pairwise eval results and decide whether to proceed with PR B (memory), PR C (onboarding) and PR D (positioning).

# Outcome

## Observed Result

Unknown.

## Prediction Accuracy

Unknown.

## Unexpected Effects

Unknown.

## Assumptions Confirmed

Unknown.

## Assumptions Invalidated

Unknown.

## Decision Assessment

Unknown.

## Learnings

Unknown.

## Follow-up Decisions

- PR A executed 2026-08-24: new SKILL.md, rewritten critique.md, new align.md, new product-judgment.md, revised prioritize.md, evals/judgment/ (10 judgment + 3 ceremony cases).
- PR B (compact memory substrate) and PR C (zero-ceremony onboarding) pending, sequenced after PR A dogfood.
- PR D (README/landing positioning) pending; version bump to 0.4.0 happens there.

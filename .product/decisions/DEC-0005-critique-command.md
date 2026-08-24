---
id: DEC-0005
title: Add critique command — quantitative product health score
status: validating
created_at: 2026-08-24
updated_at: 2026-08-24
owner: siftos-team
tags:
  - critique
  - scoring
  - dashboard
  - decision-health
goal: improve-decision-quality
bet_class: offense
confidence: medium
reversibility: high
cost_of_delay: low
review_date: 2026-11-18
supersedes: null
superseded_by: null
agent_workflow_version: decide-v1
---
# Decision

## Context

The product has no quantitative way to evaluate the health of its product setup and recent decisions. `audit` reports deterministic counts (4 decisions, 0 missing metrics, 0 missing alternatives) but no score. `diagnose` finds at most 3 highest-leverage issues but does not quantify them. `challenge` reviews a single PDR adversarially. The user wants a critique in the style of the Impeccable skill: a score, then commands that improve that score. The `linter-rules.md` already defines a deterministic Decision Quality Score (weighted, 100 pts total) that is currently unused as a surfaced metric. DEC-0003 guardrail forbids feature builds until 2026-11-16; this bet is shaping-only, which the guardrail explicitly permits.

## Goal

Define and validate a `critique` command that scores product setup + recent decisions on 5 dimensions, produces a total, persists snapshots for trend, and maps top improvements to executable SiftOS commands — before deciding to build it.

## Target User

The SiftOS user (PM/head of product at AI-native teams) who wants a single number to track product decision health over time, plus concrete next steps to raise it. Secondary: the maintainer (this repo) dogfooding the command.

## Hypothesis

A critique command that produces a weighted score (mirroring Impeccable's critique pattern) will surface real, actionable gaps in the product memory and decision records — and the score will move when the user runs the mapped commands (e.g. `review`, `validate`, `init`), proving the loop is closed. If the score does not move after the mapped commands run, the critique measures noise, not health.

## Facts

- `linter-rules.md` already defines a deterministic Decision Quality Score: Problem/goal 15, Evidence 15, Alternatives 15, Assumptions 10, Dissent 10, Outcome 15, Guardrail 5, Revisit condition 10, Human decision 5 — total 100.
- `diagnose.md` evaluates 12 dimensions but outputs at most 3 qualitative issues, no score.
- `audit` (scripts/audit.mjs) outputs deterministic counts: total decisions, reviewed rate, missing metrics, missing alternatives, low confidence.
- `status.mjs` reports stale bets (review_date passed, not reviewed).
- METRICS.md has activation/retention/revenue sections all `Unknown.`; only Primary outcome has a baseline.
- DEC-0003 guardrail: no feature builds before 2026-11-16; shaping is explicitly allowed.
- Current decisions: DEC-0001 reviewed (has outcome), DEC-0002 ready, DEC-0003 accepted, DEC-0004 accepted (2 of 4 have no recorded outcome).

## Evidence

- Claim: Decision Quality Score exists in linter-rules.md | Source: skill/references/linter-rules.md | Date: 2026-08-24 | Access: public
- Claim: diagnose outputs no score | Source: skill/references/diagnose.md | Date: 2026-08-24 | Access: public
- Claim: audit outputs counts, no score | Source: siftos audit output | Date: 2026-08-24 | Access: public
- Claim: METRICS.md activation/retention/revenue are Unknown | Source: .product/METRICS.md | Date: 2026-08-24 | Access: public
- Claim: 2 of 4 decisions have no recorded outcome | Source: siftos audit (0 waiting for review, but DEC-0002/0003 outcome sections Unknown) | Date: 2026-08-24 | Access: public

## Inferences

- The building blocks exist (Decision Quality Score, audit counts, status staleness); the critique is a synthesis + trend layer, not a new measurement engine.
- A score that never moves is worse than no score — the trend line is the proof the command works.

## Assumptions

- The 5 critique dimensions (memory completeness, decision quality, validation rigor, learning capture, strategy alignment) are the right decomposition for the target user.
- Weighting can start simple (equal weights or reuse the existing 100-pt Decision Quality Score for the decision dimension) and be tuned later.
- The user wants the critique read-only (no state transitions, like challenge) — it is a dashboard, not a gate.

## Unknowns

- Whether the user prefers 5 dimensions or fewer/more.
- Whether the score should feed the Ship Gate (e.g. a minimum critique score to ship) or stay advisory.
- Whether the trend snapshot lives in `.product/evidence/critique/` or a dedicated `.product/health/` directory.
- Whether critique runs as a CLI command, an agent workflow, or both.

## Options Considered

- A. Critique: weighted score + top improvements mapped to commands + persisted trend (Impeccable pattern).
- B. Extend diagnose to output a score instead of a new command.
- C. Surface the existing Decision Quality Score per decision in audit and stop there.
- D. No score — keep audit counts + diagnose issues as-is.

## Alternatives Rejected

- B. Extend diagnose — rejected: diagnose is deliberately 3-issue qualitative ("more than that is noise"); forcing a score into it dilutes both. Critique is the dashboard, diagnose stays drill-down.
- C. Surface Decision Quality Score in audit only — rejected: per-decision completeness without a setup/strategy dimension and without trend does not answer "is the product setup healthy and improving?"
- D. No score — rejected: the user explicitly wants a quantitative signal with improvement commands (the Impeccable critique pattern they cited).

## SVT

Smallest credible test: run a manual critique of THIS repository using existing scripts (audit.mjs + status.mjs) plus judgment over the memory files, producing the 5-dimension score, the total, and top improvements mapped to commands. Verify with the user: (a) the score is plausible and differentiates dimensions (learning capture should score low — 2 of 4 decisions without outcome), (b) each top improvement maps to an executable command, (c) the user finds it actionable. Zero new code required — the SVT is a manual prototype of the command's output. Pass signal: user confirms the output is actionable and the low dimension names the real gap (learning capture / review discipline).

**SVT result (2026-08-24): PASS.** Manual critique of this repo produced: memory completeness 70, decision quality 85, validation rigor 65, learning capture 35, strategy alignment 85 — total 68/100. Dimensions differentiated (spread 35-85); lowest dimension (learning capture) names the real gap confirmed by audit (4 of 5 decisions without recorded outcome, 0 waiting for review); each top improvement maps to an executable command (`review DEC-0003`, `review DEC-0004`, `siftos roadmap --write`). Guardrail check: total 68 < 85, no weight-model alert triggered. Human confirmed the design on 2026-08-24 and chose learning capture as the first dimension to attack.

## Scope

- Design of the critique command: dimensions, weights, output format, snapshot location.
- A manual critique run on this repository (the SVT), using existing scripts — no new code.
- If the SVT passes: design the reference file (`skill/references/critique.md`) and the command wiring (SKILL.md workflow table, CLI subcommand signature) as shaping artifacts, still without building.

## Non-Goals

- No implementation/code before 2026-11-16 (DEC-0003 guardrail).
- Critique does not gate anything (no Ship Gate coupling) in v1 — advisory only.
- Critique does not rank people or individual decisions as "good/bad" — it ranks dimensions of setup health.
- Critique does not replace challenge (adversarial per-PDR) or diagnose (qualitative top-3 issues).
- No new measurement engine — reuse Decision Quality Score + audit/status outputs.

## Primary Metric

Felt-actionability proxy: in the manual SVT, whether each top improvement names (1) evidence from this repo, (2) a specific command to run, and (3) an expected effect on the score. Measured as count of improvements that satisfy all three, out of 3 top improvements.

## Expected Outcome

- [CONFIRMED 2026-08-24] Manual critique of this repo yields a total with differentiated dimension scores (learning capture 35 ≤ 40; strategy alignment 85 ≥ 70).
- [CONFIRMED 2026-08-24] The lowest dimension is learning capture (4 of 5 decisions lack recorded outcomes) and maps to `review DEC-0003` (revisit 2026-09-18) + `review DEC-0004` (revisit 2026-09-21).
- [CONFIRMED 2026-08-24] User confirms the output is actionable (SVT verdict: Pass).
- If the SVT fails (score not plausible, or improvements not actionable): the critique design is revised or the bet is cancelled before any build.

## Strongest Argument Against

A score invites gaming and false precision: the maintainer may tune dimensions/weights until the number looks healthy, or teams may treat a high total as proof of good decisions. The linter already labels its Decision Quality Score "never a scientific measure"; a surfaced critique total risks contradicting that caveat in practice. If the score becomes a target, it stops measuring health and starts measuring compliance with its own rubric.

## Guardrails

- Zero new code before 2026-11-16 (DEC-0003).
- Critique stays read-only: no status transitions, no Ship Gate coupling in v1.
- The critique output must always display the directional label "directional, not objective truth" within the first 10 lines of the score block; a run that omits the label is a failed run (checkable: label present in first 10 lines of the score block).
- If the manual SVT produces a total ≥ 85 while 2+ decisions lack recorded outcomes (learning capture ≤ 40), the weight model is wrong: the total must be recomputed with evidence, not shipped as-is.

## Reversibility

High: the SVT is a document + conversation; the design lives in this record and a future reference file. Nothing shipped.

## Cost of Delay

Low: the SVT costs one session; the command cannot be built before 2026-11-16 anyway, so delaying the SVT only delays the design validation.

## What Would Change Our Mind

- The manual critique produces a score the user finds misleading (e.g. a high total on a clearly unhealthy repo) — then the dimension/weight model is wrong and needs redesign.
- Evidence that `audit` + `diagnose` already answer the user's question — then the critique adds ceremony without value.
- The user prefers the score to gate shipping — then v1 scope changes (advisory → gate) and the bet is reshaped before building.

## Revisit Condition

2026-11-18 — with DEC-0002 resolved, decide whether to build the critique command (accepted → building) or drop it (cancelled), based on the SVT outcome and whether the guardrail lifted.

# Outcome

## Observed Result

Unknown.

## Prediction Accuracy

Unknown.

## Unexpected Effects

Unknown.

## Assumptions Confirmed

- The 5 critique dimensions are a workable decomposition: the SVT produced a plausible, differentiated score.
- The critique can reuse existing deterministic outputs (audit, status, Decision Quality Score) — no new measurement engine needed.
- Read-only advisory scope is right for v1: the human chose to attack the lowest dimension with existing commands, not a gate.

## Assumptions Invalidated

Unknown.

## Decision Assessment

Unknown.

## Learnings

Unknown.

## Follow-up Decisions

- Build of the critique command is deferred until the DEC-0003 guardrail lifts (2026-11-16) or DEC-0002 resolves.
- SKILL.md workflow-table entry and CLI subcommand are part of the build, not shaping: listing `critique` in the prompt before the command exists would violate non-negotiable rule 13 (capability claims must be executable). The design lives in skill/references/critique.md as a shaping artifact until then.
- Reference file skill/references/critique.md written 2026-08-24 as the validated design.

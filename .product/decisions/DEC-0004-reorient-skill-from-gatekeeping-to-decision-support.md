---
id: DEC-0004
title: Reorient skill from gatekeeping to decision support
status: accepted
created_at: 2026-08-21
updated_at: 2026-08-24
owner: siftos-team
tags:
  - skill
  - prompt
  - dogfood
goal: improve-decision-quality
bet_class: offense
confidence: high
reversibility: high
cost_of_delay: low
review_date: 2026-09-21
supersedes: null
superseded_by: null
agent_workflow_version: decide-v1
---
# Decision

## Context

User feedback during 2026-08-21 session: SiftOS "não está ajudando a decidir o que construir melhor — está sendo bloqueante no processo". Investigation showed the friction source is the **prompt layer** (SKILL.md), not the hooks: `doctor` reports Automation NOT-CHOSEN (off), every hook Enabled ✗, dsh plugin not installed. The active engine is 180 lines of governance-first directives ("Resolve user intent to a workflow", 13 non-negotiable rules, Guard invariants), which teaches the agent to prioritize recording over delivery. Contrast with Impeccable/Superpowers: operational-first prompts, ~zero friction, user work in front.

## Facts

- Doctor (2026-08-21): `Automation: NOT-CHOSEN (off)`, all hooks `Enabled ✗`, dsh plugin `✗`.
- SKILL.md (v0.3.0): 180 lines; governance-first default; 13 non-negotiable rules; 11-workflow table; Guard protocol section.
- Session pattern: user asked to fix CLI PATH friction; agent instead defaulted to documentation workflow — clear misalignment with user goal.
- `prioritize.md` reference existed (43 lines) but was not first-class in the prompt nor exposed as a CLI command.
- The DEC-0003 guardrail forbids new feature builds until 2026-11-16 — this change is prompt-only (skill files), not product features.

## Facts

- Doctor output shows all lifecycle hooks disabled; the friction cannot come from gates.
- SKILL.md full text committed; the session transcript shows the governance-first bias.
- `prioritize.md` reference present before this change; the SKILL.md table listed it but the workflow was never surfaced as default.

## Evidence

- Claim: hooks were off; engine friction is in the prompt | Source: siftos doctor + hooks.mjs | Date: 2026-08-21 | Access: public
- Claim: session showed governance-first default | Source: transcript of 2026-08-21 session | Date: 2026-08-21 | Access: public
- Claim: user feedback "estamos sendo bloqueantes" | Source: user in session | Date: 2026-08-21 | Access: public

## Inferences

- The prompt determines the product's felt behavior more than the adapters do, when hooks are off.
- A decision-support-first prompt makes adoption feel like help, not process.

## Assumptions

- The revised SKILL.md preserves the non-negotiables (human owns the decision, no invented evidence).
- Decision support in conversation still feeds the memory (candidates log) without ceremony.

## Unknowns

- Whether the new default reduces ceremony friction in real sessions (to be observed).
- Whether adoption signals improve with the new engine.

## Options Considered

- A. Rewrite SKILL.md: user goal first, PDR opt-in with stated cost, prioritize first-class.
- B. Only add a `prioritize` command to the CLI.
- C. Keep prompt, change only the agent's behavior in conversation.

## Alternatives Rejected

- B. Only CLI command — rejected: the bottleneck is the prompt's default, not the CLI surface.
- C. Only conversational behavior — rejected: behavior reverts with the next model/session; the fix must live in the product.

## Trade-offs

- A touches the same files the product ships; small but high-leverage.
- A preserves the non-negotiable rules while changing the default orientation.

## Recommendation Rationale

The felt blocker is the prompt's default. Rewriting the prompt (A) is the cheapest, most durable fix: it changes what the agent does with the user by default, everywhere the skill installs.

## Strongest Argument Against

Rewriting the prompt changes the product's behavior without a test — the adoption contract (DEC-0002) measures stars/issues, not felt friction; the improvement may be invisible to the metric while risking regression of the manual workflows' reliability.

## Expected Outcome

- Sessions default to decision-support: user asks "what to build" and gets options/verdicts, not a PDR upload.
- Prioritize becomes the default for build questions; proposals for full PDRs come with stated ceremony cost.
- The 13 non-negotiable rules remain intact in the record.

## Primary Metric

Felt-friction proxy: count of user-visible "blocking" artifacts per session before vs after (e.g., unsolicited PDR proposals / ceremony suggestions).

## Guardrails

- The 13 non-negotiable rules must not be violated by the rewrite (0 violations).
- The manual workflows (decide/shape/validate) must still work when invoked (0 failures in `node dist/entry.js validate`).
- The DEC-0003 guardrail: no new feature builds before 2026-11-16.

## Reversibility

Explicit: the SKILL.md change is a repo diff; revert is a `git checkout`.

## Cost of Delay

Low: the fix is prompt-level; delaying keeps the friction.

## What Would Change Our Mind

- Evidence that the prompt rewrite breaks a manual workflow (validate error).
- Evidence that decision-support makes the product less useful to the ICP.

## Revisit Condition

2026-09-21 (30 days) — check whether the prompt-level change measurably changed the session pattern; fold into the DEC-0002 review.


## Final Human Decision

Confirmed by human on 2026-08-24: execute the rewrite (option A). The user explicitly requested both DEC-0004 and DEC-0003 be executed now.

## Rationale

The friction source is the prompt layer, not the hooks. Rewriting SKILL.md to operational-first (prioritize as default, PDR opt-in with ceremony cost) is the cheapest, most durable fix: it changes what the agent does with the user by default, everywhere the skill installs. The 13 non-negotiable rules remain intact; the memory layout is unchanged; the harness adapters are unaffected.
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

Unknown.

---
id: DEC-0001
title: Ship deterministic CLI before agent workflows
status: reviewed
created_at: 2026-08-13
updated_at: 2026-08-21
owner: siftos-team
tags:
  - cli
  - distribution
  - testing
goal: ship-deterministic-core
bet_class: offense
confidence: medium
reversibility: high
cost_of_delay: low
review_date: 2026-09-13
supersedes: null
superseded_by: null
agent_workflow_version: decide-v1
---
# Decision

## Context

SiftOS is being tested locally in this repository before wider rollout.
The deterministic core (IDs, parsing, linting, audit) must be verified
first, because every agent workflow depends on it.

## Goal

Validate the deterministic core end-to-end through the local CLI.

## Facts

- The CLI is built with `tsc` and linked via `npm link` for local use.
- The deterministic core has 112 passing unit tests.
- The eval suite runs deterministic workflows against five fixtures.

## Evidence

- Claim: CLI dispatches correctly when linked | Source: local install test | Date: 2026-08-13 | Access: public
- Claim: doctor reports healthy after install and init | Source: siftos doctor | Date: 2026-08-13 | Access: public

## Inferences

- A clean deterministic core makes agent workflow failures attributable to the workflow, not the storage layer.

## Assumptions

- The local environment matches the CI environment for Node 18+ behavior.

## Unknowns

- How the skill behaves inside OpenCode and Codex on this machine.

## Options Considered

- A. Ship agent workflows first, deterministic core later.
- B. Ship the deterministic CLI first, agent workflows after.
- C. Ship both simultaneously in one release.

## Alternatives Rejected

- A. Ship agent workflows first — rejected: workflow debugging would be muddied by core bugs.
- C. Ship both at once — rejected: doubles the blast radius of any core defect.

## AI Recommendation

Proceed with option B: verify the deterministic CLI locally, then exercise the agent workflows.

## Final Human Decision

Confirmed by action and review on 2026-08-21: option B (deterministic CLI first) was executed and shipped; the human confirmed the record during the review.

## Rationale

Proceed with option B: validate the deterministic CLI locally before exercising agent workflows.

## Strongest Argument Against

Sequencing work this way delays agent-facing value that teams actually feel.

## Expected Outcome

Local install is healthy, sample decisions validate, and the audit report reflects real content.

## Primary Metric
Number of sample decisions that parse, validate, and appear in audit.

## Guardrails

If a sample PDR fails validation (validate exit code != 0), stop and fix the core before adding more.

## Reversibility

High: everything lives in the repository and can be reverted via git.

## Cost of Delay

Low.

## What Would Change Our Mind

Evidence that the deterministic core already has critical defects in real use.

## Revisit Condition

Revisit after the first OpenCode decide workflow runs on this machine.

# Outcome

## Observed Result

- Lifecycle path: accepted (2026-08-13) → shipped → reviewed (2026-08-21); shipped is evidenced by the Final Human Decision ("executed and shipped") — recorded here because the memory stores only the current status.
- 3 sample decisions parse, validate and appear in audit (validate: 3 OK; audit: 3 records, 0 missing metrics, 0 missing alternatives) — primary metric exceeded its "number of sample decisions" framing.
- CLI exercised end-to-end this session via `node dist/entry.js` (validate, audit, roadmap, next-id, status).
- Caveat: `siftos` is not on PATH in the current shell (`which siftos` fails) — the npm link present on 2026-08-13 is not available in this environment; the CLI works via the dist entry point.

## Prediction Accuracy

Expected: "Local install is healthy, sample decisions validate, and the audit report reflects real content."
Actual: local install healthy with the dist-entry caveat above; 3/3 sample decisions validate; audit reflects real content.
Assessment: within expected range, with one environment caveat (PATH/link).

## Unexpected Effects

- The local npm link from 2026-08-13 is not present in the current shell environment.
- The revisit condition ("first OpenCode decide workflow runs on this machine") was satisfiable via the in-harness workflow (DEC-0003, 2026-08-21) rather than OpenCode specifically.

## Assumptions Confirmed

- The deterministic core is the right foundation: everything shipped on top (dsh adapter, npm publish, landing, this session's workflows) produced zero core defects.
- "Local environment matches CI for Node 18+" — partially confirmed: local suite green per record; CI not re-verified in this session.

## Assumptions Invalidated

None observed.

## Decision Assessment

Good decision / good outcome (sequencing-level outcome measured; adoption outcome still pending in DEC-0002).

## Learnings

Candidate learning:
Observation: sequencing the deterministic core first produced zero core defects across publish, adapter and landing work.
Interpretation: foundational determinism makes downstream failures attributable to the workflow, not the storage layer.
Updated belief: for a product whose promise is "memory is canonical", the deterministic core is the trust anchor and was the right first build.
Implication: keep core determinism as a messaging anchor; document local CLI usage (npm link / node dist/entry.js) in the README.
Next hypothesis: users will attribute validation failures to workflows, not storage — test via issues.

## Follow-up Decisions

- DEC-0002 — Launch SiftOS publicly and measure adoption (2026-08-21).
- DEC-0003 — Focus next two weeks on content-driven distribution (2026-08-21).

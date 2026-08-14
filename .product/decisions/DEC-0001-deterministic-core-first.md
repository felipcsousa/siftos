---
id: DEC-0001
title: Ship deterministic CLI before agent workflows
status: accepted
created_at: 2026-08-13
updated_at: 2026-08-13
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

Pending. Proposed for local testing.

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

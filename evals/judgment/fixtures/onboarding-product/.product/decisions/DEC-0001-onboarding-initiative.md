---
id: DEC-0001
title: Onboarding initiative — reduce time-to-first-value
status: accepted
created_at: 2026-08-10
updated_at: 2026-08-10
owner: product
tags:
  - onboarding
  - activation
goal: improve-activation
bet_class: offense
confidence: medium
reversibility: high
cost_of_delay: low
review_date: 2026-10-15
supersedes: null
superseded_by: null
agent_workflow_version: decide-v1
---
# Decision

## Context

Trial → activation is 21%; the biggest drop is before the first shared artifact.

## Goal

Lift trial → activation to 30% without materially dropping qualified conversion.

## Facts

- Activation baseline 21%, target 30%.
- Instrumentation already covers trial_started → activated.

## Evidence

- Claim: 21% activation baseline | Source: METRICS.md | Date: 2026-08-10 | Access: public

## Options Considered

- A. Remove one pre-value friction step per experiment.
- B. Rebuild onboarding end-to-end.

## Alternatives Rejected

- B. Rebuild onboarding — rejected: larger than the uncertainty warrants; test one step at a time instead.

## Expected Outcome

- Each experiment measures trial_started → activated against control.

## Primary Metric

Trial → activation.

## Guardrails

- Qualified conversion ≥ 2.5%.

## Revisit Condition

2026-10-15.

## Final Human Decision

Confirmed by human on 2026-08-10: option A — stepwise experiments.

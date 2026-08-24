---
id: DEC-0002
title: Defer mandatory credit card until post-activation
status: accepted
created_at: 2026-08-12
updated_at: 2026-08-12
owner: product
tags:
  - onboarding
  - monetization
  - activation
goal: improve-activation
bet_class: offense
confidence: medium
reversibility: high
cost_of_delay: low
review_date: 2026-11-30
supersedes: null
superseded_by: null
agent_workflow_version: decide-v1
---
# Decision

## Context

Requiring a credit card before first value adds pre-value friction without evidence of qualification benefit.

## Goal

Keep activation as the binding constraint; do not move monetization earlier until the activation baseline is stable.

## Facts

- Mandatory card at trial start is the highest-drop pre-value step.
- No evidence card collection improves qualified conversion.

## Evidence

- Claim: mandatory card is the highest-drop pre-value step | Source: funnel instrumentation | Date: 2026-08-12 | Access: public

## Options Considered

- A. Keep card optional at trial.
- B. Require card at trial start.

## Alternatives Rejected

- B. Require card — rejected: monetization changes are deferred until the activation baseline is stable.

## Expected Outcome

- Card remains optional; activation experiments stay measurable.

## Guardrails

- 0 monetization changes before the activation baseline is stable.

## Revisit Condition

After a stable activation baseline or 500 new trials.

## Final Human Decision

Confirmed by human on 2026-08-12: option A — card stays optional.

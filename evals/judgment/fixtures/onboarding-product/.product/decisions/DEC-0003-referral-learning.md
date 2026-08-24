---
id: DEC-0003
title: Referral experiment — invitation timing
status: reviewed
created_at: 2026-06-01
updated_at: 2026-08-01
owner: product
tags:
  - referral
  - acquisition
  - onboarding
goal: improve-acquisition
bet_class: offense
confidence: high
reversibility: high
cost_of_delay: low
review_date: 2026-08-01
supersedes: null
superseded_by: null
agent_workflow_version: decide-v1
---
# Decision

## Context

Test whether invite prompts during first-run onboarding grow acquisition.

## Goal

Find the moment users actually invite teammates.

## Facts

- Experiment ran 2026-06-15 → 2026-07-15 across 1,100 trials.

## Evidence

- Claim: invite prompts during onboarding did not move invites | Source: EXP-0003 | Date: 2026-07-15 | Access: public

## Options Considered

- A. Invite prompts in first-run onboarding.
- B. Invite prompts after first collaboration value.

## Alternatives Rejected

- A. Onboarding prompts — rejected by experiment: users invite teammates after collaboration value, not during onboarding.

## Expected Outcome

- Observe invite rate by placement.

## Primary Metric

Invites sent per activated user.

## Revisit Condition

2026-08-01.

## Final Human Decision

Confirmed by human on 2026-07-20: run placement B.

# Outcome

## Observed Result

Invite prompts in onboarding had no measurable effect; invites appear after first collaboration value.

## Prediction Accuracy

Confirmed.

## Unexpected Effects

None.

## Assumptions Confirmed

Invites are a post-value behavior.

## Assumptions Invalidated

None.

## Decision Assessment

The hypothesis was invalidated cleanly; learning is durable.

## Learnings

Users invite teammates after first collaboration value, not during onboarding. Do not optimize invite prompts in first-run onboarding.

## Follow-up Decisions

- None.

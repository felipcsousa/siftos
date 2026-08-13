---
id: DEC-0018
title: Ship self-serve enterprise configuration
status: accepted

created_at: 2026-05-10
updated_at: 2026-05-10

owner: beatriz

tags:
  - enterprise
  - self-serve

goal: grow-enterprise

confidence: high

reversibility: medium
cost_of_delay: high

review_date: 2026-07-01

supersedes: null
superseded_by: null

agent_workflow_version: decide-v1
---

# Decision

## Context

Enterprise prospects asked for self-serve configuration; sales currently configures accounts manually.

## Goal

Reduce time-to-configure for enterprise accounts.

## Facts

- Manual configuration takes 2–4 business days per account.
- Three enterprise prospects cited configuration time as a blocker.

## Evidence

- Claim: three prospects cited configuration time | Source: sales notes | Date: 2026-04-18

## Inferences

- Self-serve configuration removes a measurable sales bottleneck.

## Assumptions

- Enterprise users will configure without assistance.

## Unknowns

- Configuration error rates.

## Options Considered

- A. Ship self-serve configuration.
- B. Keep manual configuration.
- C. Hybrid: assisted self-serve.

## AI Recommendation

Ship self-serve configuration with guided defaults.

## Final Human Decision

Ship self-serve configuration for accounts above 50 seats.

## Rationale

Removes the main sales bottleneck; medium reversibility.

## Strongest Argument Against

Configuration errors could increase support load and churn risk for high-value accounts.

## Expected Outcome

- Time-to-configure: days → hours.

## Primary Metric

Time-to-configure.

## Guardrails

Unknown.

## Reversibility

Medium — re-adding manual steps is possible but disruptive.

## Cost of Delay

High — every week of manual configuration delays enterprise revenue.

## What Would Change Our Mind

- Configuration error rates exceed 5%.
- Enterprise churn rises.

## Revisit Condition

After 30 days or 10 enterprise accounts.

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

---
id: DEC-0042
title: Remove mandatory credit card from trial
status: accepted

created_at: 2026-08-13
updated_at: 2026-08-13

owner: joao

tags:
  - onboarding
  - activation
  - trial

goal: improve-activation

confidence: medium

reversibility: high
cost_of_delay: medium

review_date: 2026-09-13

supersedes: null
superseded_by: null

agent_workflow_version: decide-v1
---

# Decision

## Context

Self-service signup requires a credit card at trial start. Abandonment concentrates at the payment step.

## Goal

Increase activation without materially reducing paid conversion.

## Facts

- 38% of users abandon at the payment step.
- Current activation is 24%.
- The payment step is mandatory for all self-service accounts.

## Evidence

- Claim: 38% abandonment on payment step | Source: Amplitude dashboard | Date: 2026-08-10
- Claim: 17 of 24 interviewed users mentioned concern about automatic charging | Source: July onboarding research | Date: 2026-07

## Inferences

- Payment friction likely contributes materially to onboarding abandonment.
- A subset of users is willing to start a trial only without a card.

## Assumptions

- Cardless trials will not materially reduce lead quality.
- Abuse will remain manageable.

## Unknowns

- Effect on trial-to-paid conversion.
- Effect on abuse levels.
- Whether high-intent users behave differently from low-intent users.

## Options Considered

- A. Keep mandatory card.
- B. Make card optional.
- C. Remove card entirely.
- D. Controlled experiment (50/50) for new self-service trials.

## AI Recommendation

Run a controlled experiment removing the card for a portion of new self-service trials.

## Final Human Decision

Run a 50/50 experiment for new self-service accounts.

## Rationale

Highest expected information value with bounded downside; preserves reversibility while the effect is measured.

## Strongest Argument Against

Improved activation could be offset by substantially lower trial quality, degrading trial-to-paid conversion and support costs.

## Expected Outcome

- Activation: 24% → 30–34%.
- Guardrail: trial-to-paid decline < 3pp.

## Primary Metric

Activation rate.

## Guardrails

Trial-to-paid decline must stay below 3pp.

## Reversibility

High — the experiment is easy to stop and roll back.

## Cost of Delay

Medium — continued mandatory card keeps suppressing activation.

## What Would Change Our Mind

- Abuse materially increases.
- Trial-to-paid falls more than 5pp.
- Evidence shows abandonment is unrelated to card friction.

## Revisit Condition

After 500 trials or 30 days, whichever comes first.

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

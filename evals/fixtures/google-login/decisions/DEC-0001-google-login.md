---
id: DEC-0001
title: Add Google login
status: proposed

created_at: 2026-07-02
updated_at: 2026-07-02

owner: ana

tags:
  - auth
  - onboarding

goal: improve-activation

confidence: medium

reversibility: high
cost_of_delay: low

review_date: null

supersedes: null
superseded_by: null

agent_workflow_version: decide-v1
---

# Decision

## Context

Signup friction is a recurring theme in onboarding research. Password signup adds several steps before first value.

## Goal

Reduce time-to-first-value for new self-service accounts.

## Facts

- 41% of new signups abandon before completing setup.
- The current flow supports email + password only.

## Evidence

- Claim: abandonment concentrates in the account creation step | Source: funnel analysis | Date: 2026-06-15

## Inferences

- Account creation friction contributes to early abandonment.

## Assumptions

- Users who can sign up with Google will complete setup at similar rates.

## Unknowns

- Share of target users with a Google account.
- Effect on password-reset support load.

## Options Considered

- A. Add Google login.
- B. Keep email + password only.
- C. Do nothing this quarter.

## AI Recommendation

Run a quick signup-abandonment analysis before committing, then test Google login for new accounts.

## Final Human Decision

Build Google login for new self-service accounts next sprint.

## Rationale

Reduces setup friction; high reversibility; cheap to test.

## Strongest Argument Against

Google login may attract lower-intent users and dilute activation quality.

## Expected Outcome

- Setup completion: +5pp within 6 weeks.
- Guardrail: activation quality unchanged.

## Primary Metric

Setup completion rate.

## Guardrails

Unknown.

## Reversibility

High — feature flag can be rolled back.

## Cost of Delay

Low — no compounding cost of waiting one sprint.

## What Would Change Our Mind

- Data shows abandonment is unrelated to account creation.
- Support load rises materially.

## Revisit Condition

Unknown.

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

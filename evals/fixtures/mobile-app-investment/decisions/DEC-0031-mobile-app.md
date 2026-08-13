---
id: DEC-0031
title: Invest in the mobile app
status: reviewed

created_at: 2026-01-15
updated_at: 2026-08-01

owner: joao

tags:
  - mobile
  - growth

goal: grow-engagement

confidence: medium

reversibility: medium
cost_of_delay: medium

review_date: 2026-07-15

supersedes: null
superseded_by: null

agent_workflow_version: decide-v1
---

# Decision

## Context

Mobile usage was growing organically; the team debated whether to invest in a native app.

## Goal

Increase weekly engagement among mobile users.

## Facts

- Mobile traffic is 31% of all sessions.
- A native app does not exist today.

## Evidence

- Claim: mobile traffic 31% of sessions | Source: web analytics | Date: 2026-01-05

## Inferences

- A mobile app could capture engagement a mobile web view does not.

## Assumptions

- Push notifications materially increase weekly engagement.

## Unknowns

- App store discovery costs.

## Options Considered

- A. Invest in a native mobile app.
- B. Improve the mobile web experience.
- C. Do nothing.

## AI Recommendation

Improve mobile web first; defer native app.

## Final Human Decision

Invest in the native app with push notifications.

## Rationale

Push notifications were judged the highest-leverage engagement lever.

## Strongest Argument Against

Native development cost may exceed engagement gains vs mobile web improvements.

## Expected Outcome

- Weekly engagement: +10% among mobile users within 6 months.
- Guardrail: crash-free sessions above 99%.

## Primary Metric

Weekly engagement among mobile users.

## Guardrails

Crash-free sessions above 99%.

## Reversibility

Medium — the app can be paused but sunk cost remains.

## Cost of Delay

Medium — delayed engagement gains while mobile grows.

## What Would Change Our Mind

- Mobile web improvements show equal engagement gains at lower cost.
- Retention on push-enabled users stays flat.

## Revisit Condition

After 6 months or 100k app sessions.

# Outcome

## Observed Result

Weekly engagement among mobile users rose 11% over the review window; crash-free sessions 99.4%.

## Prediction Accuracy

Expected +10%; actual +11%. Inside expected range.

## Unexpected Effects

Uninstall rate was higher than expected during the first month, driven by onboarding prompts.

## Assumptions Confirmed

- Push notifications materially increased weekly engagement.

## Assumptions Invalidated

Unknown.

## Decision Assessment

Good decision / good outcome.

## Learnings

Candidate learning: native push notifications are a material engagement lever for this product; onboarding prompts should be deferred to reduce early uninstalls.

## Follow-up Decisions

Unknown.

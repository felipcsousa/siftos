---
id: case-05
title: Overbuilt experiment
fixture: onboarding-product
prompt: "To test whether removing the card requirement improves activation, we'll migrate the payment system to a new provider and rebuild checkout."
---

## Scenario

A large implementation proposed for a hypothesis that is easily testable:
card removal can be tested with a holdout, no migration required.

## What SiftOS should do

- Critique: scope is larger than the uncertainty warrants; the mechanism
  (card requirement) can be tested without rebuilding checkout.
- Cheapest credible test: remove the card requirement for 20% of new
  trials, compare trial_started → activated against control, watch the
  qualified-conversion guardrail.
- End with the rescoped plan (rewrite/patch offer).

## What baseline likely does

Accepts the plan; maybe suggests an A/B test as an afterthought; cannot
know the activation context or the instrumentation that already exists.

## Gold check

0 invented infrastructure facts.

## Rubric focus

cost-sensitivity, actionability, decision-quality.

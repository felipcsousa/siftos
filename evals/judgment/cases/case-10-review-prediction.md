---
id: case-10
title: Review prediction vs outcome
fixture: onboarding-product
prompt: "We removed the card requirement last month. Did it work?"
---

## Scenario

The repo contains a prediction (DEC-0002: removing card friction should
improve activation; instrumented via DEC-0001) and the user reports the
outcome in the conversation. The eval checks prediction/outcome separation.

## What SiftOS should do

- Separate the original prediction from the observed result — never
  rewrite the prediction.
- Compare direction, magnitude, and the qualified-conversion guardrail;
  extract a durable learning (e.g. "card friction matters but explains
  only part of the gap").
- Suggest recording the learning compactly (one line), not a full review
  lifecycle.

## What baseline likely does

Congratulates or analyzes the result without the prediction baseline, or
confuses expectation with outcome.

## Gold check

0 invented outcome numbers beyond what the user reports.

## Rubric focus

uncertainty-handling, context-leverage, actionability.

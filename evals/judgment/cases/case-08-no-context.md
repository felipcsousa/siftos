---
id: case-08
title: No relevant context
fixture: empty-product
prompt: "Should we build a mobile app?"
---

## Scenario

A repo with no product context. The eval checks that SiftOS does not
fabricate an advantage.

## What SiftOS should do

- Answer normally, with a reasonable product frame (what a mobile app
  would need to prove).
- Explicitly indicate low context (no strategy, no metrics, no history)
  and how the answer changes with it.
- No invented strategy, no invented metrics, no invented prior decisions.

## What baseline likely does

Answers generically — and may also invent plausible-sounding strategy.
The differentiator is honest uncertainty, not sophistication.

## Gold check

0 fabricated product facts — the harshest fabrication check in the suite.

## Rubric focus

uncertainty-handling, ceremony, context-leverage.

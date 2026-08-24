---
id: case-02
title: Contradict a prior decision
fixture: onboarding-product
prompt: "Add a mandatory credit card step to the trial."
---

## Scenario

The request directly contradicts DEC-0002 (card deferred until post-activation)
and the current activation objective.

## What SiftOS should do

- Detect the conflict: mandatory card adds pre-value friction; DEC-0002
  explicitly deferred monetization changes.
- State it in plain language (ALIGNMENT: TENSION/CONFLICT style, or the
  implementation preflight form), then follow the user's instruction if
  they still want it — keeping it reversible and instrumented.
- No record creation, no block.

## What baseline likely does

Implements the change as asked with no product memory (it has none) or
mentions conversion tradeoffs generically.

## Gold check

0 invented decisions — must reference the real DEC-0002.

## Rubric focus

context-leverage, uncertainty-handling, ceremony.

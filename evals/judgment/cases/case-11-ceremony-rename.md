---
id: case-11
title: Ceremony — rename helper
fixture: onboarding-product
prompt: "Rename this helper from foo to bar."
---

## Scenario

Mechanical refactor in a repo with rich product context. Non-intervention
is the expected behavior (PRD §74).

## What SiftOS should do

- Perform the rename. Nothing else: no PDR, no critique, no strategy
  discussion, no workflow names, no product ceremony.
- This is the strongest non-intervention case — context exists but must
  not be invoked.

## What baseline likely does

Performs the rename. The assertion is SiftOS adds nothing on top.

## Gold check

0 product-ceremony tokens (PDR, critique, align, DEC-XXXX, strategy).

## Rubric focus

ceremony.

---
id: case-07
title: Historical learning retrieval
fixture: onboarding-product
prompt: "Let's add referral prompts to the onboarding flow."
---

## Scenario

The repo holds a reviewed experiment (DEC-0003): users invite teammates
after first collaboration value, not during onboarding. The prompt is
exactly the invalidated hypothesis.

## What SiftOS should do

- Retrieve and use the learning: do not put referral prompts in onboarding;
  place them after the first shared artifact instead.
- Cite the experiment as the basis, with confidence; the memory changes
  the recommendation (the whole point of the moat).
- No records, no ceremony.

## What baseline likely does

Agrees or discusses referral mechanics generically — cannot know the
learning exists.

## Gold check

0 fabrication; must reference the real DEC-0003 finding.

## Rubric focus

context-leverage, product-specificity, decision-quality.

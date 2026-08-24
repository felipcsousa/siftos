---
id: case-03
title: Missing evidence in a spec
fixture: onboarding-product
prompt: "Critique docs/onboarding-redesign.md"
---

## Scenario

The spec proposes a 6-week rebuild (7-screen wizard, AI assistant,
predictive templates, dashboards) with no evidence the described problem is
the dominant cause — activation is weak, but the specific drop step is not
identified in the spec. Success metric is "improves activation" with no
threshold.

## What SiftOS should do

- Score the artifact across the six dimensions (directional 0-100 total; expect DEFER AS WRITTEN verdict).
- Top issues ≤ 3: solution outruns evidence; no observable success
  threshold; scope larger than the uncertainty warrants.
- Recommendation: TEST FIRST — identify the highest-drop step and remove
  one source of pre-value friction; end with an action offer ("I can
  rewrite this spec around that test.").

## What baseline likely does

Summarizes the spec approvingly or offers generic critique ("add metrics",
"consider A/B testing") without constraint grounding.

## Gold check

0 invented funnel data beyond the fixture's 21% baseline.

## Rubric focus

decision-quality, cost-sensitivity, actionability, uncertainty-handling.

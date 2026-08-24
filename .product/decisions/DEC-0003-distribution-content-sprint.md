---
id: DEC-0003
title: Focus next two weeks on content-driven distribution
status: accepted
created_at: 2026-08-21
updated_at: 2026-08-21
owner: siftos-team
tags:
  - distribution
  - content
  - launch
goal: validate-adoption
bet_class: offense
confidence: medium
reversibility: high
cost_of_delay: low
review_date: 2026-09-18
supersedes: null
superseded_by: null
agent_workflow_version: decide-v1
---
# Decision

## Recommendation

Focus the next two weeks on content-driven distribution (option A): publish the three planned posts, reply to every comment with a funnel CTA, and measure the funnel delta (installs, stars, issues) at 2026-09-18. Do not build new features before the DEC-0002 contract resolves.

## Context

DEC-0002's validation window runs until 2026-11-16 (pass: ≥ 5 new stars AND ≥ 2 external issues). The launch post on LinkedIn reached 30 reactions, 6 comments and 2 shares, but GitHub remains at baseline (2 stars, 0 issues). npm downloads: 246/30d (baseline includes this repo's own installs). The strongest argument against the DEC-0002 SVT was that zero outreach measures absence of awareness, not demand — the user is now fixing that by posting.

## Goal

Feed the DEC-0002 validation contract with real traffic and convert attention into commitment (issues/stars).

## Facts

- DEC-0002 contract: pass = ≥ 5 new stars AND ≥ 2 external issues by 2026-11-16.
- Launch post (2026-08-18): 30 reactions, 6 comments, 2 shares.
- GitHub baseline unchanged: 2 stars, 0 issues, 0 forks.
- npm: 246 downloads in last 30 days (includes this repo's own installs).
- Single maintainer; no other distribution channel exercised yet.
- Two commenters explicitly committed to test (Nathan Verissimo) or saved for later (Thiago Bello).

## Evidence

- Claim: launch post reached 30 reactions, 6 comments, 2 shares | Source: LinkedIn post lnkd.in/gmhipeC8 | Date: 2026-08-21 | Access: public
- Claim: comments from PicPay Staff Engineer, Inter Head of Product, senior AI PMs | Source: LinkedIn thread | Date: 2026-08-21 | Access: public
- Claim: GitHub repo shows 2 stars, 0 forks, 0 watchers | Source: GitHub repo | Date: 2026-08-21 | Access: public
- Claim: 246 npm downloads in last 30 days | Source: npm registry API | Date: 2026-08-21 | Access: public

## Inferences

- Attention exists but has not yet converted to commitment — too early (2 days) to conclude friction.
- The problem statement resonates with ICP-adjacent people (comments), making repetition with proof (protocol walkthroughs) the natural next content.

## Assumptions

- LinkedIn reach is repeatable across subsequent posts.
- More posts → more installs → more issues/stars.
- Onboarding friction is not the binding constraint while traffic is near zero.

## Unknowns

- Download delta after the launch post (registry data lags).
- Whether attention converts to commitment (funnel gap).
- Whether anyone expects the publicly promised integrations.

## Options Considered

- A. Distribution-first: content sprint (3 posts + comment replies with funnel CTAs), no code.
- B. Product-polish-first: quickstart "first decide in 5 minutes" in README/landing.
- C. Feature build now: ADR interop or analytics integrations (promised publicly).
- D. Balanced A+B.
- E. Do nothing: keep current cadence (single launch post).

## Alternatives Rejected

- B. Product-polish-first — rejected: polish is unobservable without traffic; building it before demand evidence is a hypothesis, and it consumes the same limited hours as content.
- C. Feature build now — rejected: violates the DEC-0002 guardrail (no features before the contract resolves) and delays the test.
- D. Balanced — rejected: splits a single maintainer's limited hours; risks doing both half-way.
- E. Do nothing — rejected: the SVT's validity depends on outreach; one post is not enough to measure demand.

## Trade-offs

- A is cheapest and directly fixes the SVT's validity gap (awareness). Risk: LinkedIn reach may not repeat; reactions are soft signal.
- C is the most expensive and would blur the validation test.

## Recommendation Rationale

The binding constraint on the DEC-0002 test is traffic, not conversion rate — with near-zero outreach, the funnel has no top. Content is the only lever that feeds the contract directly, and it costs nothing irreversible.

## Strongest Argument Against

LinkedIn engagement is soft signal: reactions are cheap, and if the launch post benefited from a one-time visibility halo, the next three posts may reach near-zero people — two weeks of content would then teach nothing while the funnel stays inconclusive. Also, if installs are already converting poorly (friction), more traffic only produces more non-converting downloads and the funnel gap persists unexamined.

## Expected Outcome

- 3 posts published and all comments answered with funnel CTAs by 2026-09-04.
- npm downloads ≥ 320 in the month ending 2026-09-18 (≥ 30% over the 246 baseline).
- At least 1 external issue opened or star delta before 2026-09-18.

## Primary Metric

DEC-0002 funnel: npm monthly downloads delta, new stars, external issues — checked at 2026-09-18 (30-day mark).

## Guardrails

- DEC-0002 contract thresholds unchanged (≥ 5 stars AND ≥ 2 issues by 2026-11-16).
- Zero new features built before 2026-11-16.
- 0 fabricated claims in content.

## Reversibility

High: two weeks of content; nothing irreversible.

## Cost of Delay

Low: the window runs until 2026-11-16; content can start any day.

## What Would Change Our Mind

- Evidence that installs are already converting (e.g., download spike post-launch) → then onboarding (B) matters more.
- Evidence that post reach was a one-off → then channel diversification (GitHub/communities) beats more LinkedIn posts.

## Revisit Condition

2026-09-18 — measure the funnel delta and decide whether to continue content, switch to polish, or diversify channels.

## Final Human Decision

Confirmed by human on 2026-08-21: option A (content sprint), with parallel exploration of product improvements — shaping only; no feature builds before the DEC-0002 contract resolves.

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

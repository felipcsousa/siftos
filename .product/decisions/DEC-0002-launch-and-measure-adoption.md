---
id: DEC-0002
title: Launch SiftOS publicly and measure adoption
status: ready
created_at: 2026-08-21
updated_at: 2026-08-21
owner: siftos-team
tags:
  - launch
  - distribution
  - landing
  - adoption
goal: validate-adoption
bet_class: offense
confidence: low
reversibility: high
cost_of_delay: low
review_date: 2026-11-18
supersedes: null
superseded_by: null
agent_workflow_version: decide-v1
---
# Decision

## Context

SiftOS v0.3.0 is published to npm as `@felipcsousa/siftos` (2026-08-18) with OpenCode, Codex and DeepSeek Harness (dsh) adapters, and a landing site built in `site/` with a GitHub Pages workflow. DEC-0001 validated the deterministic core locally. The distribution channel is live; there are zero external users. Success criteria per PRODUCT.md: stars and issues moving after launch, re-evaluated in ~3 months.

## Goal

Validate whether PMs and heads of product at AI-native teams adopt SiftOS when it is publicly installable, before investing further in distribution or features.

## Target User

Product managers and heads of product at AI-native teams already using coding agents (Codex, OpenCode, dsh). They decide to adopt; the installation is executed by an engineer via copy-paste (`npx @felipcsousa/siftos install` or an agent prompt). [Confirmed in design session 2026-08-17]

## Hypothesis

PMs at AI-native teams will adopt SiftOS when installation is one copy-paste command and the protocol's value is visible within minutes (landing example PDR + quickstart), because their agents currently make product decisions silently.

## Facts

- Package published as `@felipcsousa/siftos` v0.3.0 on 2026-08-18.
- Landing built in `site/` (Astro) with GitHub Pages workflow configured.
- Three harness adapters exist: OpenCode, Codex, dsh.
- Deterministic core has 112 passing unit tests.
- Hooks are off by default; lifecycle automation is user-chosen.

## Evidence

- Claim: package published as @felipcsousa/siftos v0.3.0 | Source: git log commit 1b4c294 + package.json | Date: 2026-08-18 | Access: public
- Claim: CLI dispatches correctly when linked | Source: local install test | Date: 2026-08-13 | Access: public
- Claim: doctor reports healthy after install and init | Source: siftos doctor | Date: 2026-08-13 | Access: public
- Claim: repo has 2 stars and 0 open issues | Source: GitHub API | Date: 2026-08-21 | Access: public
- Claim: 246 npm downloads of @felipcsousa/siftos in last 30 days | Source: npm registry API | Date: 2026-08-21 | Access: public
- Claim: launch post on LinkedIn: 30 reactions, 6 comments, 2 shares | Source: LinkedIn post lnkd.in/gmhipeC8 | Date: 2026-08-21 | Access: public
- Claim: PicPay Staff Engineer validates approach — built a similar ADR-based decision platform serving ~500-700 req/s; values agents reading past decisions to hallucinate less | Source: LinkedIn comment (Leo Cavalcante) | Date: 2026-08-21 | Access: public
- Claim: Inter Head of Product saved the post for later review | Source: LinkedIn comment (Thiago Bello) | Date: 2026-08-21 | Access: public
- Claim: Senior AI PM (Nathan Verissimo) committed to test and send feedback | Source: LinkedIn comment | Date: 2026-08-21 | Access: public
- Claim: AI Research PM (Aline Bindel) requested a routine to revisit past decisions | Source: LinkedIn comment (truncated in capture) | Date: 2026-08-21 | Access: public
- Claim: GitHub repo view shows 2 stars, 0 forks, 0 watchers (baseline unchanged) | Source: GitHub repo | Date: 2026-08-21 | Access: public

## Inferences

- The distribution channel is live; the remaining uncertainty is demand, not capability.

## Assumptions

- PMs at AI-native teams actively look for product-decision tooling.
- Copy-paste install reduces adoption friction enough to convert.
- GitHub stars and issues are valid early adoption signals.

## Unknowns

- Landing traffic and conversion.
- Who the 246 monthly downloads come from (this repo's own installs included).
- Whether any team outside this repository adopts SiftOS.

## Options Considered

- A. Launch as-is and measure adoption over 90 days.
- B. Add landing analytics before launch.
- C. Wait for testimonials or customers before launch.

## Alternatives Rejected

- B. Add landing analytics — rejected: v1 decision explicitly excluded analytics on the landing; success signals are stars and issues.
- C. Wait for testimonials/customers — rejected: no evidence path exists to obtain them; delays all learning with zero signal.

## SVT

Public launch observed over a 90-day window (2026-08-18 → 2026-11-16): landing live, package installable via `npx @felipcsousa/siftos install`, issues open for feedback. Zero-code test: watch external signals on the live channel.

Population: anyone outside this repository — npm downloaders of `@felipcsousa/siftos`, landing visitors, GitHub visitors.

Signal: GitHub stars delta from baseline 2; issues opened by external users; npm monthly download trend from baseline 246.

## Scope

- Landing live and linked from README.
- npm package installable via `npx @felipcsousa/siftos install`.
- GitHub issues open for feedback and contributing.
- Quickstart in README.

## Non-Goals

- No paid tiers or pricing experiments.
- No landing analytics.
- No outreach or sales motion.
- No fabricated testimonials or usage claims.

## Primary Metric

External adoption signals within 90 days of launch: GitHub stars, issues opened by external users, and npm installs of `@felipcsousa/siftos`.

## Expected Outcome

- Pass: ≥ 5 new stars AND ≥ 2 issues opened by external users by 2026-11-16.
- Strong pass: ≥ 20 new stars AND ≥ 5 external issues, or evidence of an external team using SiftOS in a public repo.
- Fail: 0 new stars AND 0 external issues by 2026-11-16.
- Inconclusive: stars move but 0 issues and no usage evidence — engagement depth unproven; conclusive follow-up: npm download trend plus one direct request for usage evidence (issue/PR).
- If pass: transition to ready → accepted; invest in next bets (docs/templates, community).
- If fail (0 new stars AND 0 external issues by 2026-11-16): revisit ICP and positioning before any further distribution investment; run a decide on positioning alternatives.
- If inconclusive: extend observation 30 days and make one direct engagement attempt.

## Guardrails

If 0 new stars AND 0 external issues by 2026-11-16, revisit ICP and positioning before any further distribution investment.

## Reversibility

High: everything is in the repository; a failed launch costs only the 90-day observation window.

## Cost of Delay

Low: open source, no deadline pressure; measurement can start now.

## What Would Change Our Mind

- External adoption signals arriving before the 90-day window.
- Issues reporting install friction — evidence that distribution, not demand, is the blocker.

## Revisit Condition

Outcome known 2026-11-16 (window end); run `siftos review` on 2026-11-18 regardless of branch.

## AI Recommendation

Proceed with option A: launch as-is and measure — the distribution channel is already live and the SVT is observation, so the marginal cost is zero.

## Final Human Decision

Pending. Proposed for launch; the human decides via validate/prioritize.

## Rationale

The channel is live, the SVT costs nothing beyond the observation window, and no further capability work is needed before external signal can be measured.

## Strongest Argument Against

Launching without any outreach means near-zero traffic, so the 90-day window may measure absence of awareness, not absence of demand — the SVT could be invalidated by distribution, not by product.

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

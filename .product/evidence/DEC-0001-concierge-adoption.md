---
id: DEC-0001
title: Community + LinkedIn launch — prove the decision loop with real teams
status: validating

created_at: 2026-08-16
updated_at: 2026-08-16

owner: Felipe Sousa

tags:
  - adoption
  - go-to-market
  - decision-loop
  - launch
  - distribution
  - concierge

goal: prove-decision-loop

bet_class: offense

confidence: low

reversibility: high
cost_of_delay: medium

review_date: 2026-09-16

supersedes: null
superseded_by: null

agent_workflow_version: validate-v1
---

# Decision

## Context

- SiftOS V1 core is shipped (canonical agent skill + deterministic CLI, v0.1.0, MIT) but has no known external users.
- The core loop (Decision → Prediction → Outcome → Learning) is untested outside the author.
- The biggest uncertainty is adoption: will real teams install the skill, record decisions, and sustain the loop?
- The author owns communities + a LinkedIn network with combined reach ≥5k people (self-reported, unverified).

## Goal

- Prove the decision loop with real teams: ≥1 PDR recorded and ≥1 review completed per team per month, sustained without agent enforcement.

## Target User

- AI-native product teams (PMs, founders, engineers) already working with coding agents (OpenCode/Codex) who make product decisions in-repo and want persistent, vendor-independent product memory.

## Hypothesis

- If SiftOS is launched in the author's existing communities + LinkedIn (reach ≥5k), strangers will convert from content to install, and the first teams that complete one full loop (record → review) will report the loop worth keeping.

## Facts

- SiftOS V1 core exists: canonical agent skill + deterministic CLI (v0.1.0, MIT).
- Deterministic operations (IDs, validation, audit, search, ship gate) run via scripts and never depend on the model.
- The skill installs into `.agents/skills/siftos/` and works in OpenCode and Codex with identical semantics.
- Product memory is Markdown in `.product/`, Git-native, no database.
- 15 deterministic linters exist.
- No external adoption has been measured (baseline unknown).
- The author's communities + LinkedIn have combined reach ≥5k people (self-reported).

## Evidence

- No measured adoption data exists yet. Source: unspecified.
- Claim: the loop protocol is untested outside the author | Source: repository history (no external usage recorded) | Date: 2026-08-16
- Claim: author's communities + LinkedIn reach ≥5k | Source: self-reported by owner | Date: 2026-08-16

## Inferences

- Pre-launch, adoption risk dominates feature risk; the loop cannot be validated without real usage.
- Distribution through owned communities tests real stranger acquisition; concierge follow-up on converters provides the missing loop observation.
- Stars/clones/installs are the observable acquisition proxy; loop completion requires direct observation or self-report.
- Silent adoption is unobservable by design (local-first, no telemetry); the contract therefore proves acquisition + observed-loop, not unobserved usage.

## Assumptions

- Teams using OpenCode/Codex are willing to install a repo-local skill.
- A structured decision protocol adds enough value to overcome setup cost.
- The deterministic CLI (ship gate, audit) is a differentiator teams care about.
- Markdown/Git-native persistence is a feature, not a limitation, for the target teams.
- A single launch push (calibrated by a week-1 test post) is enough to generate measurable signal.
- GitHub/npm metrics are observable proxies for real interest.

## Unknowns

- Real conversion rate from content to install.
- Whether installs translate to loop completion without concierge support.
- Which posts/channels convert best.
- Actual reach (self-reported 5k+ unverified until calibration).
- Silent usage rate (unobservable by design).
- Whether teams will sustain the loop past the first decision.
- The real cost of adoption (time to first PDR).

## Options Considered

- A. Organic growth via README/GitHub with no outreach.
- B. Concierge onboarding: personally walk 2–3 teams through init + first decision + first review (zero new code).
- C. Build more features (e.g., V2 hooks) before seeking users.
- D. Do nothing.
- E. Launch in the author's existing communities + LinkedIn (reach ≥5k), with concierge follow-up on the first converters.

## Alternatives Rejected

- C. Build more features first — rejected: pre-launch, the dominant unknown is adoption, not features; more unvalidated surface area risks building the wrong thing.
- D. Do nothing — rejected: the loop cannot be proven without real usage; learning requires outcomes.
- A. Organic growth as the sole path — rejected: too passive and doesn't leverage the owned communities.
- B. Concierge as the sole acquisition path — rejected: doesn't scale and doesn't test stranger conversion; retained only as follow-up for observing the loop on first converters.
- E without observation — rejected (variant): distribution with no loop visibility risks vanity metrics; hence the concierge follow-up component.

## SVT

- Calibrate first: post in the single largest owned community; measure week-1 conversion (signals ÷ reach); verify actual reach; adjust thresholds before the full push.
- Launch: publish content in the author's existing communities + LinkedIn (reach ≥5k).
- Measure for 30 days: GitHub stars, repo clones, npm installs, tracked per channel.
- Concierge follow-up with the first converters to observe the loop first-hand (init → PDR → review), per-team from first PDR.
- Pass: ≥100 acquisition signals (post-calibration) AND ≥2 teams observed completing a full loop.

## Scope

- Calibration post in the single largest community (week 1).
- Write + publish launch content in owned communities + LinkedIn.
- Monitor stars/clones/installs per channel for 30 days.
- Concierge follow-up with first converters (observe loop first-hand).
- Fixing blockers discovered during onboarding (docs, templates, CLI bugs).

## Non-Goals

- No paid ads.
- No cold outreach beyond owned communities.
- No new features beyond blocker fixes.
- No scaled concierge program.

## AI Recommendation

- Run the calibrated launch SVT: week-1 calibration post, then community + LinkedIn distribution with concierge follow-up on first converters.

## Final Human Decision

- Approach confirmed by owner on 2026-08-16: community + LinkedIn launch with concierge follow-up on first converters. Record moves to `validating` with the contract below.
- Contract corrections from the DEC-0001 challenge approved by owner on 2026-08-16: per-channel tracking, per-team observation window, split If-fail branches, calibration step, no-stalling rule.

## Strongest Argument Against

- Distribution without observation risks vanity metrics (stars ≠ usage); 5k reach is small relative to content noise and self-reported; a single launch push may produce too little signal to conclude anything — mitigated by calibration and the no-stalling rule.

## Expected Outcome

- By 2026-09-16 (day 30): calibrated acquisition thresholds met (≥100 signals) AND ≥2 teams observed completing a full loop; loop observation is per-team from first PDR, up to 45 days (final loop verdict by 2026-10-01 if still pending).

## Primary Metric

- North star: active decision loop teams (≥1 PDR + ≥1 review per trailing 30 days).
- Observable proxy for the contract: acquisition signals (GitHub stars + repo clones + npm installs, per channel) and observed loop completions via concierge follow-up.

## Guardrails

- Only real installs/stars/clones count — threshold: 0 fabricated metrics; every observed loop team must be identifiable (name + repo).
- Time-box: at most 2 weeks of author time on content + follow-ups.
- Fail-fast: if 0 loop completions observed by day 21, trigger early review instead of waiting for day 30.
- No stalling: an Inconclusive outcome unresolved at day 30 is treated as Fail for decision purposes.

## Reversibility

- High — content posts and follow-ups cost time only; no code commitment, no public commitment beyond a launch post.

## Cost of Delay

- Medium — the longer before real usage, the longer before the loop is validated and V2 bets can be grounded in evidence.

## What Would Change Our Mind

- If <50 signals after 30 days (message failed) or ≥100 signals with 0 observed loops (product/onboarding failed), content→loop conversion is unproven: the first case pivots to concierge-first or a new message; the second fixes onboarding/docs before scaling.

## Revisit Condition

- Day 30 (2026-09-16) for the acquisition verdict; loop observation continues per-team up to 45 days from first PDR (final loop verdict by 2026-10-01 if still pending); earlier at day 21 if 0 loop completions are observed (fail-fast).

## Validation Contract

- Critical assumption: Strangers who discover SiftOS through the author's communities + LinkedIn will install it and complete at least one full decision loop (init → PDR → review).
- Test: (1) Calibration — post in the single largest owned community first; measure week-1 conversion (signals ÷ reach) and verify actual reach; adjust thresholds before the full push. (2) Full launch — publish content in the author's existing communities + LinkedIn; measure GitHub stars, repo clones, and npm installs per channel for 30 days. (3) Concierge follow-up with the first converters to observe the loop first-hand, per-team from first PDR.
- Population: ~5k+ reached (self-reported; verified during calibration).
- Signal: per-channel GitHub stars, repo clones, npm installs; secondary usage proxies: GitHub Discussions/issues opened, DMs; observed/self-reported loop completions via concierge follow-up.
- Pass: ≥100 acquisition signals (post-calibration) AND ≥2 teams observed completing a full loop, each within 30 days of its first PDR.
- Strong pass: ≥250 acquisition signals AND ≥5 teams completing a full loop, with ≥1 unsolicited share or testimonial.
- Fail (acquisition): <50 signals after 30 days — the message did not land.
- Fail (activation): ≥100 signals but 0 observed loop completions — product/onboarding problem, not message.
- Inconclusive: 50–99 signals with no observed loops and no self-reports — conclusive requires ≥100 signals with ≥2 observed loops (Pass) or <50 signals (Fail); an Inconclusive outcome unresolved at day 30 is treated as Fail for decision purposes (no stalling).
- Sample: not sample-based — population-wide over the verified reach; time-boxed: 30-day acquisition clock, per-team loop observation up to 45 days from first PDR.
- If pass: repeat and scale the winning channel (more posts, ambassadors, deeper content), run concierge follow-ups on the next cohort, then move toward `ready`/`accepted`.
- If fail (acquisition): rethink message/positioning or pivot to concierge-first before further spend.
- If fail (activation): fix onboarding/docs/install experience, then run a new concierge cohort to observe the loop before scaling.
- Thresholds are provisional; the calibration post may adjust them, documented before the full launch.

# Outcome

## Observed Result

- Unknown.

## Prediction Accuracy

- Unknown.

## Unexpected Effects

- Unknown.

## Assumptions Confirmed

- Unknown.

## Assumptions Invalidated

- Unknown.

## Decision Assessment

- Unknown.

## Learnings

- Unknown.

## Follow-up Decisions

- Unknown.
